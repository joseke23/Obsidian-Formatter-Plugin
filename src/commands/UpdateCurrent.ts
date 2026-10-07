import { Notice, Plugin, TFolder, TFile } from 'obsidian';
import AutoFormatter from '../main.js';

export async function updateCurrent(plugin: AutoFormatter): Promise<void> {
    // Basic setup
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
    let MDFiles = currentFolder.children.filter(
        (child): child is TFile =>
            child instanceof TFile && child.extension === 'md',
    );

    // Handling Year
    const yearTemplate = plugin.app.vault.getAbstractFileByPath(plugin.settings.yearTemplatePath)
    if (!(yearTemplate instanceof TFile)) {
        new Notice(`Year Template misconfigured: ${plugin.settings.yearTemplatePath}`)
    } else {
        let years = MDFiles.filter((file): file is TFile => file.basename.contains("Year"));// Changing naming filter to allow for configurable naming conventions
        // Moving previous years to the old folder
        for (const year of years) {
            if (year?.basename !== `Year ${now.getFullYear()}`) {
                // Makes sure specific year folder exists in the old folder
                if (!plugin.app.vault.getAbstractFileByPath(`${oldFolder.path}/${year.basename.match(/\d{4}/g)?.join()}`)) {
                    await plugin.app.vault.createFolder(`${oldFolder.path}/${year.basename.match(/\d{4}/g)?.join()}`);
                }
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
        MDFiles = currentFolder.children.filter(
            (child): child is TFile =>
                child instanceof TFile && child.extension === 'md',
        );
        // Creating a new year if it doesn't exist
        years = MDFiles.filter((file): file is TFile => file.basename.contains("Year"));
        if (years.length == 0) {
            const content = await plugin.app.vault.read(yearTemplate);
            const newFile = await plugin.app.vault.create(
                `${currentFolder.path}/Year ${now.getFullYear()}.md`,
                content,);
            let count = 0;
            // Replacing Month 0000-00 with Month YYYY-MM
            await plugin.app.vault.process(newFile, (content) => {
                return content.replaceAll("Month 0000-00", () => {
                    count++;
                    return `Month ${now.getFullYear()}-${(count).toString().padStart(2, '0')}`;
                });
            });
        }
    }
    // Handling Month
    const monthTemplate = plugin.app.vault.getAbstractFileByPath(plugin.settings.monthTemplatePath)
    if (!(monthTemplate instanceof TFile)) {
        new Notice(`Month Template misconfigured: ${plugin.settings.monthTemplatePath}`)
    }
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