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
    } else {
        let months = MDFiles.filter((file): file is TFile => file.basename.contains("Month"));// Changing naming filter to allow for configurable naming conventions
        // Moving previous months to the old folder
        for (const month of months) {
            if (month?.basename !== `Month ${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`) {
                let year = month.basename.match(/\d{4}/g)?.join();
                let monthNum = month.basename.match(/-\d{2}/g)?.join().replace("-", "");
                if (year && monthNum) {
                    // Makes sure specific year folder exists in the old folder
                    if (!plugin.app.vault.getAbstractFileByPath(`${oldFolder.path}/${year}`)) {
                        await plugin.app.vault.createFolder(`${oldFolder.path}/${year}`);
                    }
                    // Makes sure specific month folder exists in the old folder
                    if (!plugin.app.vault.getAbstractFileByPath(`${oldFolder.path}/${year}/${monthNum}`)) {
                        await plugin.app.vault.createFolder(`${oldFolder.path}/${year}/${monthNum}`);
                    }
                    let add = "";
                    while (plugin.app.vault.getAbstractFileByPath(`${oldFolder.path}/${year}/${monthNum}/${month.basename + add}.md`)) {
                        if (add === "") {
                            add = "0"
                        }
                        add = "(" + (parseInt(add.replace(/\D/g, ""), 10) + 1).toString() + ")";
                    }
                    await plugin.app.vault.rename(month, `${oldFolder.path}/${year}/${monthNum}/${month.basename + add}.md`);
                }
            }
        }
        MDFiles = currentFolder.children.filter(
            (child): child is TFile =>
                child instanceof TFile && child.extension === 'md',
        );
        // Creating a new month if it doesn't exist
        months = MDFiles.filter((file): file is TFile => file.basename.contains("Month"));
        if (months.length == 0) {
            const content = await plugin.app.vault.read(monthTemplate);
            const newFile = await plugin.app.vault.create(
                `${currentFolder.path}/Month ${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}.md`,
                content,);
            let count = (7 - new Date(now.getFullYear(), now.getMonth(), 1).getDay()) % 7 - 5;
            await plugin.app.vault.process(newFile, (content) => {
                return content.replaceAll("Week 0000-00-00", () => {
                    count += 7;
                    return `Week ${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${(count).toString().padStart(2, '0')}`;
                });
            });
        }
    }
    // Handling Week
    const weekTemplate = plugin.app.vault.getAbstractFileByPath(plugin.settings.weekTemplatePath)
    if (!(weekTemplate instanceof TFile)) {
        new Notice(`Week Template misconfigured: ${plugin.settings.weekTemplatePath}`)
    } else {
        let weeks = MDFiles.filter((file): file is TFile => file.basename.contains("Week"));// Changing naming filter to allow for configurable naming conventions
        // Moving previous weeks to the old folder
        for (const week of weeks) {
            if (week?.basename !== `Week ${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${(now.getDate() - now.getDay() + 1).toString().padStart(2, '0')}`) {
                let year = week.basename.match(/\d{4}/g)?.join();
                let monthNum = week.basename.match(/-\d{2}/g)?.join().replace("-", "");
                let weekNum = week.basename.match(/-\d{2}$/g)?.join().replace("-", "");
                if (year && monthNum && weekNum) {
                    // Makes sure specific year folder exists in the old folder
                    if (!plugin.app.vault.getAbstractFileByPath(`${oldFolder.path}/${year}`)) {
                        await plugin.app.vault.createFolder(`${oldFolder.path}/${year}`);
                    }
                    // Makes sure specific month folder exists in the old folder
                    if (!plugin.app.vault.getAbstractFileByPath(`${oldFolder.path}/${year}/${monthNum}`)) {
                        await plugin.app.vault.createFolder(`${oldFolder.path}/${year}/${monthNum}`);
                    }
                    let add = "";
                    while (plugin.app.vault.getAbstractFileByPath(`${oldFolder.path}/${year}/${monthNum}/${week.basename + add}.md`)) {
                        if (add === "") {
                            add = "0"
                        }
                        add = "(" + (parseInt(add.replace(/\D/g, ""), 10) + 1).toString() + ")";
                    }
                    await plugin.app.vault.rename(week, `${oldFolder.path}/${year}/${monthNum}/${week.basename + add}.md`);
                }
            }
        }
        MDFiles = currentFolder.children.filter(
            (child): child is TFile =>
                child instanceof TFile && child.extension === 'md',
        );
        // Creating a new week if it doesn't exist
        weeks = MDFiles.filter((file): file is TFile => file.basename.contains("Week"));
        if (weeks.length == 0) {
            const content = await plugin.app.vault.read(weekTemplate);
            await plugin.app.vault.create(
                `${currentFolder.path}/Week ${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${(now.getDate() - now.getDay() + 1).toString().padStart(2, '0')}.md`,
                content);
        }
    }
}