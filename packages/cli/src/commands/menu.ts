import {
  showBanner,
  formatCommand,
  formatDescription,
  createSeparator,
  formatBoxHeader,
  formatBoxLine,
  formatBoxFooter,
  formatSecondary,
} from '../utils/tui';

export async function showMenu(): Promise<void> {
  showBanner();

  console.log();
  console.log(formatBoxHeader('Available Commands'));
  console.log(formatBoxLine(''));

  const commands = [
    {
      command: 'init',
      description: 'Initialize xRPC in your project with interactive setup',
      example: 'xrpc init',
    },
    {
      command: 'generate',
      description: 'Generate type-safe clients and servers from API contracts',
      example: 'xrpc generate -i src/api.ts -o generated -t go',
    },
    {
      command: 'help',
      description: 'Show comprehensive help and documentation',
      example: 'xrpc help [command]',
    },
  ];

  for (const cmd of commands) {
    console.log(formatBoxLine(`${formatCommand(cmd.command.padEnd(12))} ${formatDescription(cmd.description)}`));
    console.log(formatBoxLine(`${' '.repeat(12)} ${formatSecondary(`Example: ${cmd.example}`)}`));
    console.log(formatBoxLine(''));
  }

  console.log(formatBoxFooter());
  console.log();
  console.log(formatSecondary('Run "xrpc <command> --help" for more information on a specific command.'));
  console.log();
}
