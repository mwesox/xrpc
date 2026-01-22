import { parseContract } from '@xrpc/parser';
import { getGenerator, listTargets, type GeneratorConfig } from '@xrpc/generator';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  formatSuccess,
  formatError,
  formatWarning,
  formatPath,
  formatTarget,
  formatInfo,
} from '../utils/tui';

export interface GenerateOptions {
  input?: string;
  output?: string;
  targets?: string;
  prompt?: any;
  spinner?: any;
}

export async function generateCommand(options: GenerateOptions = {}): Promise<void> {
  const { prompt, spinner: createSpinner } = options;
  
  // Interactive prompts for missing arguments
  let input = options.input;
  if (!input && prompt) {
    input = await prompt('API contract file path:', {
      default: 'src/api.ts',
    });
    // Validate file exists
    if (!existsSync(input)) {
      throw new Error(`File not found: ${input}`);
    }
  } else if (!input) {
    throw new Error('Input file path is required. Use -i/--input or run in interactive mode.');
  }

  let output = options.output;
  if (!output && prompt) {
    output = await prompt('Output directory:', {
      default: 'generated',
    });
  } else if (!output) {
    output = 'generated';
  }

  let targets: string[] = [];
  if (options.targets) {
    targets = options.targets.split(',').map((t) => t.trim());
  } else if (prompt) {
    const availableTargets = listTargets();
    const selected = await prompt.select('Select targets to generate:', {
      options: availableTargets,
      multiple: true,
    });
    targets = Array.isArray(selected) ? selected : [selected];
  } else {
    throw new Error('Targets are required. Use -t/--targets or run in interactive mode.');
  }

  // Validate targets
  const availableTargets = listTargets();
  const invalidTargets = targets.filter((t) => !availableTargets.includes(t));

  if (invalidTargets.length > 0) {
    console.error(
      formatError(
        `Unknown targets: ${invalidTargets.join(', ')}. Available targets: ${availableTargets.join(', ')}`
      )
    );
    process.exit(1);
  }

  // Start generation with progress tracking
  const genSpinner = createSpinner ? createSpinner('Parsing contract...') : null;
  if (genSpinner) genSpinner.start();

  try {
    const contract = await parseContract(input);
    if (genSpinner) {
      genSpinner.succeed(`Found ${contract.endpoints.length} endpoint${contract.endpoints.length !== 1 ? 's' : ''}`);
    } else {
      console.log(`Found ${contract.endpoints.length} endpoint${contract.endpoints.length !== 1 ? 's' : ''}`);
    }

    for (const target of targets) {
      const targetSpinner = createSpinner ? createSpinner(`Generating ${formatTarget(target)} code...`) : null;
      if (targetSpinner) targetSpinner.start();

      try {
        await generateForTarget(target, contract, output, input, createSpinner);
        if (targetSpinner) {
          targetSpinner.succeed(`Generated ${formatTarget(target)} code`);
        }
      } catch (error) {
        if (targetSpinner) {
          targetSpinner.fail(`Failed to generate ${formatTarget(target)} code`);
        }
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        throw error;
      }
    }

    console.log();
    console.log(formatSuccess('Generation complete!'));
    console.log(formatInfo(`Output directory: ${formatPath(output)}`));
  } catch (error) {
    if (genSpinner) genSpinner.fail('Generation failed');
    console.error(formatError(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function generateForTarget(
  target: string,
  contract: any,
  outputDir: string,
  inputPath: string,
  createSpinner?: any
): Promise<void> {
  const generator = getGenerator(target);
  if (!generator) {
    throw new Error(`Generator not found for target: ${target}`);
  }

  // Target-specific output directory structure
  // React uses 'client' instead of 'server'
  const subDir = target === 'react' ? 'client' : 'server';
  const targetOutputDir = join(outputDir, target, subDir);
  await mkdir(targetOutputDir, { recursive: true });

  const config: GeneratorConfig = {
    outputDir: targetOutputDir,
    packageName: subDir,
    options: {
      contractPath: inputPath, // Pass contract path for React target
    },
  };

  const files = generator.generate(contract, config);

  // Write generated files with progress indication
  const fileSpinner = createSpinner ? createSpinner('Writing files...') : null;
  if (fileSpinner) fileSpinner.start();

  const writtenFiles: string[] = [];

  // Determine file extensions based on target
  const typesExt = target === 'react' ? '.ts' : '.go';
  const serverExt = target === 'react' ? '.ts' : '.go';
  const clientExt = target === 'react' ? '.ts' : '.go';
  const validationExt = target === 'react' ? '.ts' : '.go';

  if (files.types) {
    const typesPath = join(targetOutputDir, `types${typesExt}`);
    await Bun.write(typesPath, files.types);
    writtenFiles.push(typesPath);
  }

  if (files.server) {
    const serverPath = join(targetOutputDir, `router${serverExt}`);
    await Bun.write(serverPath, files.server);
    writtenFiles.push(serverPath);
  }

  if (files.client) {
    const clientPath = join(targetOutputDir, `client${clientExt}`);
    await Bun.write(clientPath, files.client);
    writtenFiles.push(clientPath);
  }

  if (files.validation) {
    const validationPath = join(targetOutputDir, `validation${validationExt}`);
    await Bun.write(validationPath, files.validation);
    writtenFiles.push(validationPath);
  }

  if (fileSpinner) {
    fileSpinner.succeed(`Wrote ${writtenFiles.length} file${writtenFiles.length !== 1 ? 's' : ''}`);
  }

  // Show generated files
  for (const file of writtenFiles) {
    console.log(`  ${formatSuccess('Generated')} ${formatPath(file)}`);
  }
}
