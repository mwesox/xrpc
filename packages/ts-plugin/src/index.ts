import type tsModule from "typescript/lib/tsserverlibrary";
import { findDeepestNodeAtPosition, resolveXrpcDefinitions } from "./core";

function init(modules: { typescript: typeof tsModule }) {
  const ts = modules.typescript;

  function create(
    info: tsModule.server.PluginCreateInfo,
  ): tsModule.LanguageService {
    const languageService = info.languageService;
    const proxy = Object.create(null) as tsModule.LanguageService;

    for (const key of Object.keys(languageService) as Array<
      keyof tsModule.LanguageService
    >) {
      const value = languageService[key];
      (proxy as any)[key] = (...args: unknown[]) =>
        (value as any).apply(languageService, args as any[]);
    }

    const getXrpcDefinitions = (
      fileName: string,
      position: number,
    ): tsModule.DefinitionInfo[] | undefined => {
      const program = languageService.getProgram();
      if (!program) {
        return undefined;
      }

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) {
        return undefined;
      }

      return resolveXrpcDefinitions(ts, program, sourceFile, position);
    };

    proxy.getDefinitionAtPosition = (
      fileName: string,
      position: number,
    ): readonly tsModule.DefinitionInfo[] | undefined => {
      const definitions = getXrpcDefinitions(fileName, position);
      if (definitions && definitions.length > 0) {
        return definitions;
      }
      return languageService.getDefinitionAtPosition(fileName, position);
    };

    proxy.getDefinitionAndBoundSpan = (
      fileName: string,
      position: number,
    ): tsModule.DefinitionInfoAndBoundSpan | undefined => {
      const definitions = getXrpcDefinitions(fileName, position);
      if (!definitions || definitions.length === 0) {
        return languageService.getDefinitionAndBoundSpan(fileName, position);
      }

      const fallback = languageService.getDefinitionAndBoundSpan(
        fileName,
        position,
      );
      if (fallback?.textSpan) {
        return {
          textSpan: fallback.textSpan,
          definitions,
        };
      }

      const program = languageService.getProgram();
      const sourceFile = program?.getSourceFile(fileName);
      const node = sourceFile
        ? findDeepestNodeAtPosition(ts, sourceFile, position)
        : undefined;

      return {
        textSpan:
          node?.getWidth(sourceFile) && sourceFile
            ? ts.createTextSpan(
                node.getStart(sourceFile),
                node.getWidth(sourceFile),
              )
            : ts.createTextSpan(position, 1),
        definitions,
      };
    };

    return proxy;
  }

  return { create };
}

export default init;

// TS Server loads plugins with `require(...)` and expects the module value to be the factory function.
if (typeof module !== "undefined") {
  module.exports = init;
}
