import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface EndpointResolution {
  endpoint: string;
  declarationFileName: string;
}

type TsModule = typeof import("typescript/lib/tsserverlibrary");

export function resolveXrpcDefinitions(
  ts: TsModule,
  program: import("typescript/lib/tsserverlibrary").Program,
  sourceFile: import("typescript/lib/tsserverlibrary").SourceFile,
  position: number,
): import("typescript/lib/tsserverlibrary").DefinitionInfo[] | undefined {
  const checker = program.getTypeChecker();
  const node = findDeepestNodeAtPosition(ts, sourceFile, position);
  if (!node) {
    return undefined;
  }

  const resolution = findEndpointResolution(ts, checker, node);
  if (!resolution) {
    return undefined;
  }

  const contractSource = resolveContractSourceFile(
    ts,
    program,
    resolution.declarationFileName,
  );
  if (!contractSource) {
    return undefined;
  }

  const span = findEndpointSpanInContract(ts, contractSource, resolution.endpoint);
  if (!span) {
    return undefined;
  }

  return [
    {
      fileName: contractSource.fileName,
      textSpan: span,
      kind: ts.ScriptElementKind.memberVariableElement,
      name: resolution.endpoint,
      containerKind: ts.ScriptElementKind.objectLiteralElement,
      containerName: "router",
    },
  ];
}

export function findDeepestNodeAtPosition(
  ts: TsModule,
  sourceFile: import("typescript/lib/tsserverlibrary").SourceFile,
  position: number,
): import("typescript/lib/tsserverlibrary").Node | undefined {
  let current: import("typescript/lib/tsserverlibrary").Node = sourceFile;

  while (true) {
    let next: import("typescript/lib/tsserverlibrary").Node | undefined;

    ts.forEachChild(current, (child) => {
      if (
        position >= child.getFullStart() &&
        position < child.getEnd() &&
        next === undefined
      ) {
        next = child;
      }
      return undefined;
    });

    if (!next) {
      return current;
    }
    current = next;
  }
}

function findEndpointResolution(
  ts: TsModule,
  checker: import("typescript/lib/tsserverlibrary").TypeChecker,
  node: import("typescript/lib/tsserverlibrary").Node,
): EndpointResolution | undefined {
  const symbol = checker.getSymbolAtLocation(node);
  const fromSymbol = findEndpointFromSymbol(ts, checker, symbol);
  if (fromSymbol) {
    return fromSymbol;
  }

  if (ts.isStringLiteral(node) && isEndpointName(node.text)) {
    const nodeSymbol = checker.getSymbolAtLocation(node.parent?.name ?? node);
    const fromNodeSymbol = findEndpointFromSymbol(ts, checker, nodeSymbol);
    if (fromNodeSymbol) {
      return fromNodeSymbol;
    }

    const propertyAssignment = ts.isPropertyAssignment(node.parent)
      ? node.parent
      : undefined;
    const objectLiteral =
      propertyAssignment && ts.isObjectLiteralExpression(propertyAssignment.parent)
        ? propertyAssignment.parent
        : undefined;
    if (objectLiteral && typeof checker.getContextualType === "function") {
      const contextualType = checker.getContextualType(objectLiteral);
      const contextualProp = contextualType?.getProperty(node.text);
      const fromContextualProp = findEndpointFromSymbol(
        ts,
        checker,
        contextualProp,
      );
      if (fromContextualProp) {
        return fromContextualProp;
      }
    }
  }

  return undefined;
}

function findEndpointFromSymbol(
  ts: TsModule,
  checker: import("typescript/lib/tsserverlibrary").TypeChecker,
  symbol: import("typescript/lib/tsserverlibrary").Symbol | undefined,
): EndpointResolution | undefined {
  if (!symbol) {
    return undefined;
  }

  const visited = new Set<import("typescript/lib/tsserverlibrary").Symbol>();
  const queue: import("typescript/lib/tsserverlibrary").Symbol[] = [symbol];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const declarations = current.getDeclarations() ?? [];
    for (const declaration of declarations) {
      const endpointTag = readEndpointTag(ts, declaration);
      if (endpointTag) {
        return {
          endpoint: endpointTag,
          declarationFileName: declaration.getSourceFile().fileName,
        };
      }

      const fromDeclaration = findEndpointFromDeclaration(
        ts,
        checker,
        declaration,
      );
      if (fromDeclaration) {
        return fromDeclaration;
      }
    }

    if (
      current.flags & ts.SymbolFlags.Alias &&
      typeof checker.getAliasedSymbol === "function"
    ) {
      try {
        const aliased = checker.getAliasedSymbol(current);
        if (aliased) {
          queue.push(aliased);
        }
      } catch {
        // Ignore aliases that cannot be resolved
      }
    }
  }

  return undefined;
}

function findEndpointFromDeclaration(
  ts: TsModule,
  checker: import("typescript/lib/tsserverlibrary").TypeChecker,
  declaration: import("typescript/lib/tsserverlibrary").Declaration,
): EndpointResolution | undefined {
  if (!ts.isPropertyAssignment(declaration)) {
    return undefined;
  }

  const calledIdentifier = extractCalledFunctionIdentifier(ts, declaration.initializer);
  if (!calledIdentifier) {
    return undefined;
  }

  const calledSymbol = checker.getSymbolAtLocation(calledIdentifier);
  const fromCalledSymbol = findEndpointFromSymbol(ts, checker, calledSymbol);
  if (!fromCalledSymbol) {
    return undefined;
  }

  return fromCalledSymbol;
}

function extractCalledFunctionIdentifier(
  ts: TsModule,
  expression: import("typescript/lib/tsserverlibrary").Expression,
): import("typescript/lib/tsserverlibrary").Identifier | undefined {
  const unwrapped = unwrapExpression(ts, expression);

  if (ts.isArrowFunction(unwrapped) || ts.isFunctionExpression(unwrapped)) {
    if (ts.isCallExpression(unwrapped.body)) {
      const called = unwrapExpression(ts, unwrapped.body.expression);
      return ts.isIdentifier(called) ? called : undefined;
    }

    if (ts.isBlock(unwrapped.body)) {
      for (const statement of unwrapped.body.statements) {
        if (!ts.isReturnStatement(statement) || !statement.expression) {
          continue;
        }
        const returned = unwrapExpression(ts, statement.expression);
        if (ts.isCallExpression(returned)) {
          const called = unwrapExpression(ts, returned.expression);
          if (ts.isIdentifier(called)) {
            return called;
          }
        }
      }
    }
  }

  if (ts.isCallExpression(unwrapped)) {
    const called = unwrapExpression(ts, unwrapped.expression);
    return ts.isIdentifier(called) ? called : undefined;
  }

  return undefined;
}

function readEndpointTag(
  ts: TsModule,
  declaration: import("typescript/lib/tsserverlibrary").Declaration,
): string | undefined {
  const tags = ts.getJSDocTags(declaration);
  for (const tag of tags) {
    const tagName = String((tag.tagName as any).escapedText ?? "");
    if (tagName !== "xrpcEndpoint") {
      continue;
    }

    if (typeof tag.comment === "string") {
      const value = tag.comment.trim();
      if (isEndpointName(value)) {
        return value;
      }
    }
  }

  return undefined;
}

function resolveContractSourceFile(
  ts: TsModule,
  program: import("typescript/lib/tsserverlibrary").Program,
  declarationFileName: string,
): import("typescript/lib/tsserverlibrary").SourceFile | undefined {
  const declarationDir = path.dirname(declarationFileName);
  const typesPath = path.join(declarationDir, "types.ts");
  const normalizedTypesPath = normalizePath(typesPath);

  const typesSource =
    program.getSourceFile(typesPath) ?? program.getSourceFile(normalizedTypesPath);
  if (!typesSource) {
    return undefined;
  }

  const contractSpecifier = readRouterImportSpecifier(ts, typesSource);
  if (!contractSpecifier) {
    return undefined;
  }

  const contractPath = resolveModuleSpecifierPath(typesSource.fileName, contractSpecifier);
  if (!contractPath) {
    return undefined;
  }

  const normalizedContractPath = normalizePath(contractPath);
  const fromProgram =
    program.getSourceFile(contractPath) ??
    program.getSourceFile(normalizedContractPath);
  if (fromProgram) {
    return fromProgram;
  }

  if (!existsSync(contractPath)) {
    return undefined;
  }

  const text = readFileSync(contractPath, "utf-8");
  return ts.createSourceFile(contractPath, text, ts.ScriptTarget.Latest, true);
}

function readRouterImportSpecifier(
  ts: TsModule,
  sourceFile: import("typescript/lib/tsserverlibrary").SourceFile,
): string | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) {
      continue;
    }

    for (const element of bindings.elements) {
      const importName = element.propertyName ?? element.name;
      if (importName.text === "router") {
        return statement.moduleSpecifier.text;
      }
    }
  }

  return undefined;
}

function resolveModuleSpecifierPath(
  containingFile: string,
  moduleSpecifier: string,
): string | undefined {
  if (!(moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/"))) {
    return undefined;
  }

  const base = path.resolve(path.dirname(containingFile), moduleSpecifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.mts"),
    path.join(base, "index.cts"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function findEndpointSpanInContract(
  ts: TsModule,
  sourceFile: import("typescript/lib/tsserverlibrary").SourceFile,
  endpoint: string,
): import("typescript/lib/tsserverlibrary").TextSpan | undefined {
  const endpointRef = parseEndpointReference(endpoint);
  if (!endpointRef) {
    return undefined;
  }

  const initializerMap = buildInitializerMap(ts, sourceFile);

  const routerDecl = findVariableDeclaration(ts, sourceFile, "router");
  const routerObject = routerDecl?.initializer
    ? resolveCreateCallObject(ts, routerDecl.initializer, "createRouter", initializerMap)
    : undefined;
  if (!routerObject) {
    return undefined;
  }

  if (!endpointRef.groupName) {
    const endpointProp = findFlatEndpointProperty(
      ts,
      routerObject,
      endpointRef.endpointName,
      initializerMap,
    );
    if (!endpointProp) {
      return undefined;
    }

    const start = endpointProp.name.getStart(sourceFile);
    const length = endpointProp.name.getWidth(sourceFile);
    return ts.createTextSpan(start, length);
  }

  const groupObject = findEndpointGroupObject(
    ts,
    routerObject,
    endpointRef.groupName,
    initializerMap,
  );
  if (!groupObject) {
    return undefined;
  }

  const endpointProp = findPropertyByName(
    ts,
    groupObject,
    endpointRef.endpointName,
  );
  if (!endpointProp) {
    return undefined;
  }

  const start = endpointProp.name.getStart(sourceFile);
  const length = endpointProp.name.getWidth(sourceFile);
  return ts.createTextSpan(start, length);
}

function parseEndpointReference(
  endpoint: string,
): { groupName?: string; endpointName: string } | undefined {
  if (!isEndpointName(endpoint)) {
    return undefined;
  }

  const separator = endpoint.indexOf(".");
  if (separator === -1) {
    return { endpointName: endpoint };
  }

  return {
    groupName: endpoint.slice(0, separator),
    endpointName: endpoint.slice(separator + 1),
  };
}

function findFlatEndpointProperty(
  ts: TsModule,
  routerObject: import("typescript/lib/tsserverlibrary").ObjectLiteralExpression,
  endpointName: string,
  initializerMap: Map<string, import("typescript/lib/tsserverlibrary").Expression>,
):
  | import("typescript/lib/tsserverlibrary").PropertyAssignment
  | import("typescript/lib/tsserverlibrary").ShorthandPropertyAssignment
  | undefined {
  const endpointProperty = findPropertyByName(ts, routerObject, endpointName);
  if (!endpointProperty) {
    return undefined;
  }

  const endpointExpr = propertyToExpression(ts, endpointProperty);
  const resolvedExpr = endpointExpr
    ? resolveExpression(ts, endpointExpr, initializerMap)
    : undefined;

  return isEndpointCallExpression(ts, resolvedExpr) ? endpointProperty : undefined;
}

function findEndpointGroupObject(
  ts: TsModule,
  routerObject: import("typescript/lib/tsserverlibrary").ObjectLiteralExpression,
  expectedGroupName: string,
  initializerMap: Map<string, import("typescript/lib/tsserverlibrary").Expression>,
): import("typescript/lib/tsserverlibrary").ObjectLiteralExpression | undefined {
  for (const property of routerObject.properties) {
    if (!(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))) {
      continue;
    }

    const groupResolution = resolveGroupProperty(
      ts,
      property,
      initializerMap,
    );
    if (!groupResolution || groupResolution.groupName !== expectedGroupName) {
      continue;
    }

    return groupResolution.groupObject;
  }

  return undefined;
}

function resolveGroupProperty(
  ts: TsModule,
  property:
    | import("typescript/lib/tsserverlibrary").PropertyAssignment
    | import("typescript/lib/tsserverlibrary").ShorthandPropertyAssignment,
  initializerMap: Map<string, import("typescript/lib/tsserverlibrary").Expression>,
): {
  groupName: string;
  groupObject: import("typescript/lib/tsserverlibrary").ObjectLiteralExpression;
} | undefined {
  const routerKey = readPropertyName(ts, property.name);
  if (!routerKey) {
    return undefined;
  }

  const propertyExpr = propertyToExpression(ts, property);
  if (!propertyExpr) {
    return undefined;
  }

  const resolvedExpr = resolveExpression(ts, propertyExpr, initializerMap);
  if (!resolvedExpr) {
    return undefined;
  }

  const unwrapped = unwrapExpression(ts, resolvedExpr);
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return {
      groupName: routerKey,
      groupObject: unwrapped,
    };
  }

  if (!ts.isCallExpression(unwrapped)) {
    return undefined;
  }

  const called = unwrapExpression(ts, unwrapped.expression);
  if (!ts.isIdentifier(called)) {
    return undefined;
  }

  if (called.text === "createEndpoint") {
    const endpointObject = resolveCallArgObject(ts, unwrapped, 0);
    if (!endpointObject) {
      return undefined;
    }

    return {
      groupName: routerKey,
      groupObject: endpointObject,
    };
  }

  if (called.text === "group") {
    const explicitName = resolveCallArgString(ts, unwrapped, 0, initializerMap);
    const endpointObject = resolveCallArgObject(ts, unwrapped, 1);
    if (!explicitName || !endpointObject) {
      return undefined;
    }

    return {
      groupName: explicitName,
      groupObject: endpointObject,
    };
  }

  return undefined;
}

function propertyToExpression(
  ts: TsModule,
  property:
    | import("typescript/lib/tsserverlibrary").PropertyAssignment
    | import("typescript/lib/tsserverlibrary").ShorthandPropertyAssignment,
): import("typescript/lib/tsserverlibrary").Expression | undefined {
  if (ts.isPropertyAssignment(property)) {
    return property.initializer;
  }
  return property.name;
}

function resolveCallArgObject(
  ts: TsModule,
  callExpr: import("typescript/lib/tsserverlibrary").CallExpression,
  argIndex: number,
): import("typescript/lib/tsserverlibrary").ObjectLiteralExpression | undefined {
  const argExpr = callExpr.arguments[argIndex];
  if (!argExpr) {
    return undefined;
  }

  const unwrappedArg = unwrapExpression(ts, argExpr);
  return ts.isObjectLiteralExpression(unwrappedArg) ? unwrappedArg : undefined;
}

function resolveCallArgString(
  ts: TsModule,
  callExpr: import("typescript/lib/tsserverlibrary").CallExpression,
  argIndex: number,
  initializerMap: Map<string, import("typescript/lib/tsserverlibrary").Expression>,
): string | undefined {
  const argExpr = callExpr.arguments[argIndex];
  if (!argExpr) {
    return undefined;
  }

  const resolvedExpr = resolveExpression(ts, argExpr, initializerMap);
  if (!resolvedExpr) {
    return undefined;
  }

  const unwrapped = unwrapExpression(ts, resolvedExpr);
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }

  return undefined;
}

function isEndpointCallExpression(
  ts: TsModule,
  expression: import("typescript/lib/tsserverlibrary").Expression | undefined,
): boolean {
  if (!expression) {
    return false;
  }

  const unwrapped = unwrapExpression(ts, expression);
  if (!ts.isCallExpression(unwrapped)) {
    return false;
  }

  const called = unwrapExpression(ts, unwrapped.expression);
  return (
    ts.isIdentifier(called) &&
    (called.text === "query" || called.text === "mutation")
  );
}

function buildInitializerMap(
  ts: TsModule,
  sourceFile: import("typescript/lib/tsserverlibrary").SourceFile,
): Map<string, import("typescript/lib/tsserverlibrary").Expression> {
  const map = new Map<string, import("typescript/lib/tsserverlibrary").Expression>();

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        continue;
      }
      map.set(declaration.name.text, declaration.initializer);
    }
  }

  return map;
}

function findVariableDeclaration(
  ts: TsModule,
  sourceFile: import("typescript/lib/tsserverlibrary").SourceFile,
  name: string,
): import("typescript/lib/tsserverlibrary").VariableDeclaration | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        return declaration;
      }
    }
  }

  return undefined;
}

function resolveCreateCallObject(
  ts: TsModule,
  expression: import("typescript/lib/tsserverlibrary").Expression,
  callName: string,
  initializerMap: Map<string, import("typescript/lib/tsserverlibrary").Expression>,
  depth = 0,
): import("typescript/lib/tsserverlibrary").ObjectLiteralExpression | undefined {
  if (depth > 10) {
    return undefined;
  }

  const resolved = resolveExpression(ts, expression, initializerMap, depth);
  if (!resolved || !ts.isCallExpression(resolved)) {
    return undefined;
  }

  const callee = unwrapExpression(ts, resolved.expression);
  if (!ts.isIdentifier(callee) || callee.text !== callName) {
    return undefined;
  }

  const [firstArg] = resolved.arguments;
  if (!firstArg) {
    return undefined;
  }

  const argExpr = unwrapExpression(ts, firstArg);
  if (ts.isObjectLiteralExpression(argExpr)) {
    return argExpr;
  }

  return undefined;
}

function resolveExpression(
  ts: TsModule,
  expression: import("typescript/lib/tsserverlibrary").Expression,
  initializerMap: Map<string, import("typescript/lib/tsserverlibrary").Expression>,
  depth = 0,
): import("typescript/lib/tsserverlibrary").Expression | undefined {
  if (depth > 10) {
    return undefined;
  }

  const unwrapped = unwrapExpression(ts, expression);
  if (!ts.isIdentifier(unwrapped)) {
    return unwrapped;
  }

  const initializer = initializerMap.get(unwrapped.text);
  if (!initializer) {
    return unwrapped;
  }

  return resolveExpression(ts, initializer, initializerMap, depth + 1) ?? initializer;
}

function findPropertyByName(
  ts: TsModule,
  objectLiteral: import("typescript/lib/tsserverlibrary").ObjectLiteralExpression,
  propertyName: string,
): import("typescript/lib/tsserverlibrary").PropertyAssignment | import("typescript/lib/tsserverlibrary").ShorthandPropertyAssignment | undefined {
  for (const property of objectLiteral.properties) {
    if (
      ts.isShorthandPropertyAssignment(property) &&
      property.name.text === propertyName
    ) {
      return property;
    }

    if (
      ts.isPropertyAssignment(property) &&
      readPropertyName(ts, property.name) === propertyName
    ) {
      return property;
    }
  }

  return undefined;
}

function readPropertyName(
  ts: TsModule,
  propertyName:
    | import("typescript/lib/tsserverlibrary").PropertyName
    | import("typescript/lib/tsserverlibrary").MemberName,
): string | undefined {
  if (ts.isIdentifier(propertyName)) {
    return propertyName.text;
  }
  if (ts.isStringLiteral(propertyName) || ts.isNumericLiteral(propertyName)) {
    return propertyName.text;
  }
  return undefined;
}

function unwrapExpression(
  ts: TsModule,
  expression: import("typescript/lib/tsserverlibrary").Expression,
): import("typescript/lib/tsserverlibrary").Expression {
  let current = expression;

  while (true) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isAsExpression(current)) {
      current = current.expression;
      continue;
    }
    if (typeof (ts as any).isSatisfiesExpression === "function") {
      if ((ts as any).isSatisfiesExpression(current)) {
        current = (current as any).expression;
        continue;
      }
    }
    return current;
  }
}

function isEndpointName(value: string): boolean {
  return /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)?$/.test(value);
}

function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}
