/*import { evalInObsidian, reloadPlugin } from 'obsidian-integration-testing';
import { DEFAULT_PERIODS } from '../../src/settings.js';

const pluginId = 'Formatter';
const workingRoot = 'Integration Test';
const dayPeriod = DEFAULT_PERIODS.find((period) => period.name === 'Day');

if (!dayPeriod) {
    throw new Error('The default day period is missing');
}

const settings = {
    currentFolderPath: `${workingRoot}/Current`,
    archiveFolderPath: `${workingRoot}/Archive`,
    periods: [{
        ...dayPeriod,
        templatePath: `${workingRoot}/Templates/Day.md`,
    }],
};

type FixtureSet = {
    templateContent?: string;
    currentFiles?: Array<{ name: string; content: string }>;
    archiveFiles?: Array<{ path: string; content: string }>;
};

const defaultTemplate = 'Created on {{Day 1: yyyy-MM-dd}}';

function dayNoteName(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `Day ${year}-${month}-${day}.md`;
}

function dayDateText(date = new Date()): string {
    return dayNoteName(date).slice('Day '.length, -'.md'.length);
}

async function prepareVault(fixtures: FixtureSet = {}): Promise<void> {
    await evalInObsidian({
        input: { fixtures, settings, workingRoot, defaultTemplate },
        callback: async ({ app, fixtures: fixtureSet, settings: configuredSettings, workingRoot: root, defaultTemplate: template }) => {
            const ensureFolder = async (path: string): Promise<void> => {
                let currentPath = '';
                for (const part of path.split('/').filter(Boolean)) {
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    if (!app.vault.getAbstractFileByPath(currentPath)) {
                        await app.vault.createFolder(currentPath);
                    }
                }
            };

            const existingRoot = app.vault.getAbstractFileByPath(root);
            if (existingRoot) {
                await app.vault.delete(existingRoot, true);
            }

            await ensureFolder(configuredSettings.currentFolderPath);
            await ensureFolder(configuredSettings.archiveFolderPath);
            await ensureFolder(`${root}/Templates`);
            await app.vault.create(
                `${root}/Templates/Day.md`,
                fixtureSet.templateContent ?? template,
            );

            for (const file of fixtureSet.currentFiles ?? []) {
                await app.vault.create(`${configuredSettings.currentFolderPath}/${file.name}`, file.content);
            }
            for (const file of fixtureSet.archiveFiles ?? []) {
                const pathParts = file.path.split('/');
                await ensureFolder(pathParts.slice(0, -1).join('/'));
                await app.vault.create(file.path, file.content);
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

async function getMarkdownPaths(folderPath: string): Promise<string[]> {
    return evalInObsidian({
        input: { folderPath },
        callback: async ({ app, obsidianModule, folderPath: path }) => {
            const folder = app.vault.getAbstractFileByPath(path);
            if (!(folder instanceof obsidianModule.TFolder)) {
                throw new Error(`Missing folder: ${path}`);
            }
            return folder.children
                .filter(
                    (file): file is InstanceType<typeof obsidianModule.TFile> =>
                        file instanceof obsidianModule.TFile && file.extension === 'md',
                )
                .map((file) => file.path)
                .sort();
        },
    });
}

async function readVaultFile(path: string): Promise<string> {
    return evalInObsidian({
        input: { path },
        callback: async ({ app, obsidianModule, path: filePath }) => {
            const file = app.vault.getAbstractFileByPath(filePath);
            if (!(file instanceof obsidianModule.TFile)) {
                throw new Error(`Missing file: ${filePath}`);
            }
            return app.vault.read(file);
        },
    });
}

async function expectFile(path: string, content: string): Promise<void> {
    await expect(readVaultFile(path)).resolves.toBe(content);
}

describe('updateCurrent integration', () => {
    it('creates and formats the current note from the template', async () => {
        const expectedDate = new Date();
        await prepareVault();
        await reloadFormatter();

        const path = `${settings.currentFolderPath}/${dayNoteName(expectedDate)}`;
        await expectFile(path, `Created on ${dayDateText(expectedDate)}`);
    });

    it('does not overwrite an existing current note', async () => {
        const currentName = dayNoteName();
        await prepareVault({
            currentFiles: [{ name: currentName, content: 'Keep this content' }],
        });
        await reloadFormatter();

        await expectFile(`${settings.currentFolderPath}/${currentName}`, 'Keep this content');
        await expect(getMarkdownPaths(settings.currentFolderPath)).resolves.toEqual([
            `${settings.currentFolderPath}/${currentName}`,
        ]);
    });

    it('archives an old note, preserves its content, and creates the current note', async () => {
        const expectedDate = new Date();
        const currentName = dayNoteName(expectedDate);
        await prepareVault({
            currentFiles: [{ name: 'Day 2000-01-01.md', content: 'Archive me' }],
        });
        await reloadFormatter();

        await expectFile(
            `${settings.archiveFolderPath}/2000/01/Day 2000-01-01.md`,
            'Archive me',
        );
        await expectFile(
            `${settings.currentFolderPath}/${currentName}`,
            `Created on ${dayDateText(expectedDate)}`,
        );
        await expect(getMarkdownPaths(settings.currentFolderPath)).resolves.toEqual([
            `${settings.currentFolderPath}/${currentName}`,
        ]);
    });

    it('creates nested archive folders and uses a unique path for collisions', async () => {
        await prepareVault({
            currentFiles: [{ name: 'Day 2000-01-01.md', content: 'Archive me' }],
            archiveFiles: [{
                path: `${settings.archiveFolderPath}/2000/01/Day 2000-01-01.md`,
                content: 'Existing archive',
            }],
        });
        await reloadFormatter();

        await expectFile(
            `${settings.archiveFolderPath}/2000/01/Day 2000-01-01.md`,
            'Existing archive',
        );
        await expectFile(
            `${settings.archiveFolderPath}/2000/01/Day 2000-01-01 (1).md`,
            'Archive me',
        );
    });

    it('ignores unrelated files in the current folder', async () => {
        const currentName = dayNoteName();
        await prepareVault({
            currentFiles: [
                { name: 'README.md', content: 'Do not move' },
                { name: 'Day not-a-date.md', content: 'Do not move' },
                { name: 'image.png', content: 'Do not move' },
            ],
        });
        await reloadFormatter();

        await expectFile(`${settings.currentFolderPath}/README.md`, 'Do not move');
        await expectFile(`${settings.currentFolderPath}/Day not-a-date.md`, 'Do not move');
        await expect(getMarkdownPaths(settings.currentFolderPath)).resolves.toEqual([
            `${settings.currentFolderPath}/${currentName}`,
            `${settings.currentFolderPath}/Day not-a-date.md`,
            `${settings.currentFolderPath}/README.md`,
        ]);
    });
});
*/