import { showBanner, formatCommand, formatDescription, createSeparator } from '../utils/tui';

export async function showMenu(): Promise<void> {
  showBanner();
  
  console.log('\n' + formatCommand('Available Commands:') + '\n');
  
  const commands = [
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
    console.log(`  ${formatCommand(cmd.command.padEnd(12))} ${formatDescription(cmd.description)}`);
    console.log(`  ${' '.repeat(12)} ${formatDescription(`Example: ${cmd.example}`)}`);
    console.log();
  }

  console.log(createSeparator());
  console.log(formatDescription('Run "xrpc <command> --help" for more information on a specific command.'));
  console.log();
}
