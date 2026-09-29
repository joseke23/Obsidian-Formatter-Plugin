import { Notice, Plugin, TFolder, TFile } from 'obsidian';
import AutoFormatter from '../main.js';

export async function updateCurrent(plugin: AutoFormatter): Promise<void> {
    const currentFolder = plugin.app.vault.getAbstractFileByPath(plugin.settings.currentFolderPath);

    if (!(currentFolder instanceof TFolder)) {
        new Notice(`Current folder misconfigured: ${plugin.settings.currentFolderPath}`)
        return;
    }

    const MDFiles = currentFolder.children.filter(
        (child): child is TFile =>
            child instanceof TFile && child.extension === 'md',
    );

    const now = new Date();



}
/*
const file = this.app.workspace.getActiveFile();
if (!file) return;

// Read the entire file
const content = await this.app.vault.read(file);

// Replace the entire file
await this.app.vault.modify(file, newContent);

// Read, transform, and write atomically
await this.app.vault.process(file, (content) => {
    return content.replace('old text', 'new text');
});

// Create a markdown file
const newFile = await this.app.vault.create(
    'Folder/New note.md',
    '# New note\n\nContent here.\n',
);

// Rename or move a file
await this.app.fileManager.renameFile(file, 'Archive/Renamed note.md');

// Delete a file
await this.app.vault.delete(file);
*/