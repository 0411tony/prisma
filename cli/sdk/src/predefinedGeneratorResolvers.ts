import resolvePkg from 'resolve-pkg'
import chalk from 'chalk'
import prompts from 'prompts'
import execa from 'execa'
import path from 'path'
import Debug from 'debug'
const debugEnabled = Debug.enabled('generator')

export type GeneratorPaths = {
  outputPath: string
  generatorPath: string
}

export type GeneratorResolver = (
  baseDir: string,
  version?: string,
) => Promise<GeneratorPaths>

export type PredefinedGeneratorResolvers = {
  [generatorName: string]: GeneratorResolver
}

export const predefinedGeneratorResolvers: PredefinedGeneratorResolvers = {
  photonjs: async (baseDir, version) => {
    let photonDir = resolvePkg('@prisma/photon', { cwd: baseDir })

    if (debugEnabled) {
      console.log({ photonDir })
    }

    if (!photonDir) {
      if (!process.stdout.isTTY) {
        throw new PhotonFacadeMissingError()
      } else {
        console.log(
          `In order to use the ${chalk.underline(
            '"photonjs"',
          )} generator, you need to install ${chalk.bold(
            '@prisma/photon',
          )} to your project.`,
        )
        const { value } = await prompts({
          type: 'confirm',
          name: 'value',
          message: 'Do you want to install it now?',
          initial: true,
        })

        if (!value) {
          throw new PhotonFacadeMissingError()
        }

        await installPackage(baseDir, `@prisma/photon@${version ?? 'latest'}`)
      }
      photonDir = resolvePkg('@prisma/photon', { cwd: baseDir })

      if (!photonDir) {
        throw new Error(
          `Could not resolve @prisma/photon despite the installation that just happened. We're sorry.
Please try to install it by hand and rerun ${chalk.bold(
            'prisma2 generate',
          )} 🙏.`,
        )
      }
    }

    return {
      outputPath: photonDir,
      generatorPath: path.resolve(photonDir, 'generator-build/index.js'),
    }
  },
}

class PhotonFacadeMissingError extends Error {
  constructor() {
    super(`In order to use the ${chalk.underline(
      '"photonjs"',
    )} generator, you need to install ${chalk.bold(
      '@prisma/photon',
    )} to your project:
${chalk.bold.green('npm install @prisma/photon')}`)
  }
}

async function installPackage(baseDir: string, pkg: string): Promise<void> {
  const yarnInstalled = await isYarnInstalled()

  const cmdName = yarnInstalled ? 'yarn add' : 'npm install'

  await execa.command(`${cmdName} ${pkg}`, {
    cwd: baseDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      SKIP_GENERATE: 'true',
    },
  })
}

async function isYarnInstalled(): Promise<boolean> {
  try {
    await execa.command(`yarn --version`, { stdio: `ignore` })
    return true
  } catch (err) {
    return false
  }
}
