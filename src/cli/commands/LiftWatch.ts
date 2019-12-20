import { arg, Command, Dictionary, format, GeneratorDefinitionWithPackage, HelpError } from '@prisma/cli'
import chalk from 'chalk'
import { Lift } from '../../Lift'
import { ensureDatabaseExists } from '../../utils/ensureDatabaseExists'
import { occupyPath } from '../../utils/occupyPath'
import { ProviderAliases } from '@prisma/sdk'

/**
 * $ prisma migrate new
 */
export class LiftWatch implements Command {
  public static new(providerAliases: ProviderAliases): LiftWatch {
    return new LiftWatch(providerAliases)
  }

  // static help template
  private static help = format(`
    Watch local changes and migrate automatically

    ${chalk.bold('Usage')}

      prisma dev

    ${chalk.bold('Options')}

      -c, --create-db   Create the database in case it doesn't exist
      --auto-approve    Skip interactive approval before migrating
  `)
  private constructor(private readonly providerAliases: ProviderAliases) {}

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--preview': Boolean,
      '-p': '--preview',
      '--create-db': Boolean,
      '-c': '--create-db',
      '--auto-approve': Boolean,
    })
    const preview = args['--preview'] || false
    
    if (args['--help']) {
      return this.help()
    }

    await occupyPath(process.cwd())

    await ensureDatabaseExists('dev', false, args['--create-db'] || process.platform === 'win32')

    const lift = new Lift()
    return lift.watch({
      preview,
      providerAliases: this.providerAliases,
      autoApprove: args['--auto-approve'],
    })
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftWatch.help}`)
    }
    return LiftWatch.help
  }
}
