import { arg, Command, format, getSchema, getSchemaDir, HelpError, isError } from '@prisma/cli'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import prompt from 'prompts'
import { promisify } from 'util'
import { Lift } from '../../Lift'
import { ensureDatabaseExists } from '../../utils/ensureDatabaseExists'
import { printFiles } from '../../utils/printFiles'
import { printMigrationId } from '../../utils/printMigrationId'
import { serializeFileMap } from '../../utils/serializeFileMap'
import { ExperimentalFlagError } from '../../utils/experimental'

const writeFile = promisify(fs.writeFile)

/**
 * $ prisma migrate save
 */
export class LiftSave implements Command {
  public static new(): LiftSave {
    return new LiftSave()
  }

  // static help template
  private static help = format(`
    Save a migration

    ${chalk.bold('Usage')}

      ${chalk.dim(`$`)} prisma migrate save [options] --experimental

    ${chalk.bold('Options')}

      -h, --help       Displays this help message
      -n, --name       Name the migration
      -c, --create-db  Create the database in case it doesn't exist
      -p, --preview    Get a preview of which migration would be created next

    ${chalk.bold('Examples')}

      Create a new migration
      ${chalk.dim(`$`)} prisma migrate save --experimental

      Create a new migration by name
      ${chalk.dim(`$`)} prisma migrate save --name "add unique to email" --experimental

  `)
  private constructor() {}

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--name': String,
      '-n': '--name',
      '--preview': Boolean,
      '-p': '--preview',
      '--create-db': Boolean,
      '-c': '--create-db',
      '--experimental': Boolean,
    })
    if (!args['--experimental']) {
      throw new ExperimentalFlagError()
    }
    if (isError(args)) {
      return this.help(args.message)
    } else if (args['--help']) {
      return this.help()
    }
    const preview = args['--preview'] || false
    await ensureDatabaseExists('create', true, args['--create-db'])

    const lift = new Lift()

    const migration = await lift.createMigration('DUMMY_NAME')

    if (!migration) {
      lift.stop()
      return `Everything up-to-date\n` // TODO: find better wording
    }

    const name = preview ? args['--name'] : await this.name(args['--name'])

    const { files, newLockFile, migrationId } = await lift.save(migration, name, preview)

    if (migration.warnings && migration.warnings.length > 0) {
      console.log(chalk.bold(`\n\n⚠️  There might be data loss when applying the migration:\n`))
      for (const warning of migration.warnings) {
        console.log(chalk(`  • ${warning.description}`))
      }
      console.log()
    }

    if (preview) {
      lift.stop()
      return `\nRun ${chalk.greenBright('prisma lift save --name MIGRATION_NAME')} to create the migration\n`
    }

    await getSchema() // just to leverage on its error handling
    const schemaDir = (await getSchemaDir())! // TODO: Probably getSchemaDir() should return Promise<string> instead of Promise<string | null>

    const migrationsDir = path.join(schemaDir, 'migrations', migrationId)
    await serializeFileMap(files, migrationsDir)
    const lockFilePath = path.join(schemaDir, 'migrations', 'lift.lock')
    await writeFile(lockFilePath, newLockFile)

    lift.stop()

    return `\nLift just created your migration ${printMigrationId(migrationId)} in\n\n${chalk.dim(
      printFiles(`migrations/${migrationId}`, files),
    )}\n\nRun ${chalk.greenBright('prisma2 migrate up --experimental')} to apply the migration\n`
  }

  // get the name
  public async name(name?: string): Promise<string | undefined> {
    if (name === '') {
      return undefined
    }
    if (name) {
      return name
    }
    const response = await prompt({
      type: 'text',
      name: 'name',
      message: `Name of migration`,
    })
    return response.name || undefined
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftSave.help}`)
    }
    return LiftSave.help
  }
}
