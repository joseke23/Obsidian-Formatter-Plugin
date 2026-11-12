import { evalInObsidian, reloadPlugin } from 'obsidian-integration-testing';
import { DEFAULT_PERIODS } from '../../src/settings.js';
/*

Parts that need to be written
- File handling for notes
  - Moving file to existing archive folder
  - Creating new archive folder
  - Handling existing file in archive folder
  - Checking content matches the old note
- Templating
  - Note names
  - Note content

Structure
- Initialise the settings
- Prepare the template folder
  - Copy all the templates from resources to the template folder
- Prepare the current folder
  - Prepare the archive folder
  - Create archive for 

*/

const pluginId = 'Formatter';
const fixtureRoot = 'Integration Fixtures';
const workingRoot = 'Integration Test';

const settings = {
    currentFolderPath: `${workingRoot}/Current`,
    archiveFolderPath: `${workingRoot}/Archive`,
    periods: DEFAULT_PERIODS.filter((period) => period.name === 'Day').map((period) => ({
        ...period,
        templatePath: `${workingRoot}/Templates/${period.name}.md`,
    })),
};

type FixtureSet = {
    template: string;
    expected: string;
    source?: string;
};

async function readFixture(path: string): Promise<string> {
    return evalInObsidian({
        input: { path },
        callback: async ({ app, obsidianModule, path: fixturePath }) => {
            const file = app.vault.getAbstractFileByPath(fixturePath);
            if (!(file instanceof obsidianModule.TFile)) {
                throw new Error(`Missing integration fixture: ${fixturePath}`);
            }
            return app.vault.read(file);
        },
    });
}

async function prepareVault(fixtures: FixtureSet): Promise<void> {
    const templateContent = await readFixture(`${fixtureRoot}/${fixtures.template}`);
    const sourceContent = fixtures.source
        ? await readFixture(`${fixtureRoot}/${fixtures.source}`)
        : undefined;

    await evalInObsidian({
        input: { templateContent, sourceContent },
        callback: async ({ app, templateContent: content, sourceContent: source }) => {
            const ensureFolder = async (path: string): Promise<void> => {
                const parts = path.split('/');
                let currentPath = '';
                for (const part of parts) {
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    if (!app.vault.getAbstractFileByPath(currentPath)) {
                        await app.vault.createFolder(currentPath);
                    }
                }
            };

            const workingFolder = app.vault.getAbstractFileByPath(workingRoot);
            if (workingFolder) {
                await app.vault.delete(workingFolder, true);
            }

            await ensureFolder(`${workingRoot}/Current`);
            await ensureFolder(`${workingRoot}/Archive`);
            await ensureFolder(`${workingRoot}/Templates`);
            await app.vault.create(
                `${workingRoot}/Templates/Day.md`,
                content,
            );
            if (source !== undefined) {
                await app.vault.create(
                    `${workingRoot}/Current/Day 2000-01-01.md`,
                    source,
                );
            }
        },
    });
}

async function reloadFormatter(): Promise<void> {
    const result = await reloadPlugin({
        pluginId,
        dataJsonText: JSON.stringify(settings),
    });
    expect(result.errorMessage).toBeUndefined();
    expect(result.isLoaded).toBe(true);
}

async function readGeneratedDay(): Promise<{ content: string; path: string }> {
    return evalInObsidian({
        input: { currentFolderPath: settings.currentFolderPath },
        callback: async ({ app, obsidianModule, currentFolderPath }) => {
            const folder = app.vault.getAbstractFileByPath(currentFolderPath);
            if (!(folder instanceof obsidianModule.TFolder)) {
                throw new Error(`Missing current folder: ${currentFolderPath}`);
            }
            const file = folder.children.find(
                (child): child is InstanceType<typeof obsidianModule.TFile> =>
                    child instanceof obsidianModule.TFile &&
                    child.extension === 'md' &&
                    child.basename.startsWith('Day '),
            );
            if (!file) {
                throw new Error('The formatter did not create a current day note');
            }
            return { content: await app.vault.read(file), path: file.path };
        },
    });
}

describe('Update current integration', () => {
    it('formats a current note with FormatTemplate', async () => {
        await prepareVault({
            template: 'Day Template.md',
            expected: 'Day Expected.md',
        });
        await reloadFormatter();

        const generated = await readGeneratedDay();
        expect(generated.content).toBe(await readFixture(`${fixtureRoot}/Day Expected.md`));
    });

    it('archives an existing period note and creates the next current note', async () => {
        await prepareVault({
            template: 'Day Template.md',
            expected: 'Day Expected.md',
            source: 'Day Archive Source.md',
        });
        await reloadFormatter();

        const archived = await evalInObsidian({
            input: { archiveFolderPath: settings.archiveFolderPath },
            callback: async ({ app, obsidianModule, archiveFolderPath }) => {
                const archiveFolder = app.vault.getAbstractFileByPath(archiveFolderPath);
                if (!(archiveFolder instanceof obsidianModule.TFolder)) {
                    throw new Error(`Missing archive folder: ${archiveFolderPath}`);
                }
                const file = app.vault.getMarkdownFiles().find(
                    (candidate) =>
                        candidate.path.startsWith(`${archiveFolderPath}/`) &&
                        candidate.basename === 'Day 2000-01-01',
                );
                if (!file) {
                    throw new Error('The formatter did not archive the existing day note');
                }
                return app.vault.read(file);
            },
        });
        expect(archived).toBe(await readFixture(`${fixtureRoot}/Day Archive Source.md`));
    });
});
