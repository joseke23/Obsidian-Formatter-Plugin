import { Notice, Plugin, TFolder, TFile } from 'obsidian';
import AutoFormatter from '../main.js';

export async function updateCurrent(plugin: AutoFormatter): Promise<void> {
    const currentFolder = plugin.app.vault.getAbstractFileByPath(plugin.settings.currentFolderPath);
    if (!(currentFolder instanceof TFolder)) {
        new Notice(`Current folder misconfigured: ${plugin.settings.currentFolderPath}`)
        return;
    }

    const oldFolder = plugin.app.vault.getAbstractFileByPath(plugin.settings.oldFolderPath);
    if (!(oldFolder instanceof TFolder)) {
        new Notice(`Old folder misconfigured: ${plugin.settings.oldFolderPath}`)
        return;
    }

    const now = new Date();
    const MDFiles = currentFolder.children.filter(
        (child): child is TFile =>
            child instanceof TFile && child.extension === 'md',
    );

    const yearTemplate = plugin.app.vault.getAbstractFileByPath(plugin.settings.yearTemplatePath)
    if (!(yearTemplate instanceof TFile)) {
        new Notice(`Year Template misconfigured: ${plugin.settings.yearTemplatePath}`)
    } else {
        let years = MDFiles.filter((file): file is TFile => file.basename.contains("Year"));// Changing naming filter to allow for configurable naming conventions
        for (const year of years) {
            if (year?.basename !== `Year ${now.getFullYear()}`) {
                let add = "";
                while (plugin.app.vault.getAbstractFileByPath(`${oldFolder.path}/${year.basename.match(/\d{4}/g)?.join()}/${year.basename + add}.md`)) {
                    if (add === "") {
                        add = "0"
                    }
                    add = "(" + (parseInt(add.replace(/\D/g, ""), 10) + 1).toString() + ")";
                }
                await plugin.app.vault.rename(year, `${oldFolder.path}/${year.basename.match(/\d{4}/g)?.join()}/${year.basename + add}.md`);
            }
        }
        years = MDFiles.filter((file): file is TFile => file.basename.contains("Year"));
        if (years.length == 0) {
            const content = await plugin.app.vault.read(yearTemplate);
            const newFile = await plugin.app.vault.create(
                `${currentFolder.path}/Year ${now.getFullYear()}.md`,
                content,);
        }


    }

    const month = MDFiles.filter((file): file is TFile => file.basename.contains("Month")).first();
    const week = MDFiles.filter((file): file is TFile => file.basename.contains("Week")).first();



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