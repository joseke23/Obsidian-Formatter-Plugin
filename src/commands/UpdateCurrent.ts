import { Notice, Plugin } from 'obsidian';

export async function updateCurrent(plugin: Plugin): Promise<void> {

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