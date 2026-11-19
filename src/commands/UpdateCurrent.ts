import { Notice, TFolder, TFile } from 'obsidian';
import AutoFormatter from '../main.js';
import type { Period } from '../settings.js';
import { format } from 'date-fns';


// Formats a template string for a given start date
export function formatTemplate(content: string, periodStart: Date, periods: Period[]): string {
    let periodDates = new Map<string, Date[]>();
    const periodNames = periods
        .map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
    const regex = new RegExp(
        `\\{\\{(${periodNames})\\s+(-?\\d+):\\s*([^}]+)\\}\\}`,
    );
    let match = regex.exec(content);
    // Initialises variables in the loop
    let targetDate = new Date(0);
    let nextDate = new Date(0);

    // Iterates through all matches of the regex in the content, replacing them with the formatted date for the specified period and period number
    // Updates periodDates with the dates for the period if they don't exist yet until they reach the period number specified in the template
    while (match) {
        // Matches regex and extracts relevant shit
        try {
            match = regex.exec(content);
            if (match === null) {
                break;
            }
            const [_, periodName, periodNumberText, dateFormatText] = match;

            const periodNumber = Number(periodNumberText);
            if (periodNumber < 0) {
                new Notice(`Invalid period number: ${periodNumber}`);
                content = content.replace(match[0], '');
                continue;
            }
            if (dateFormatText === undefined || dateFormatText.trim() === '') {
                new Notice(`Invalid date format: ${dateFormatText}`);
                content = content.replace(match[0], '');
                continue;
            }
            if (periodName === undefined || periodName.trim() === '') {
                new Notice(`Invalid period name: ${periodName}`);
                content = content.replace(match[0], '');
                continue;
            }
            const dateFormat = dateFormatText.trim();
            const period = periods.find((p) => p.name === periodName);
            // Resets variables in the loop
            targetDate = new Date(0);
            nextDate = new Date(0);

            if (!period) {
                new Notice(`Period not found: ${periodName}`);
                content = content.replace(match[0], '');
                continue;
            } else {
                // Checks in cache
                if (periodDates.has(periodName) && ((periodDates.get(periodName) ?? []).length < periodNumber)) {
                    targetDate = (periodDates.get(periodName) ?? [])[periodNumber - 1] ?? new Date(0);
                    continue;
                } else {
                    //console.log(`Calculating cached date for period: ${periodName} number: ${periodNumber}`);
                    // Fills in cache
                    // Period numbers are 1-indexed
                    // PeriodDates consists of the start dates
                    while ((periodDates.get(periodName) ?? []).length < periodNumber) {
                        let dates = periodDates.get(periodName);
                        if (!dates) {
                            dates = [period.periodDefinition(periodStart)[0]];
                            periodDates.set(periodName, dates);
                            continue;
                        }
                        let date = dates?.[dates.length - 1];
                        if (!date) {
                            new Notice(`Could not determine last date for period: ${periodName}`);
                            break;
                        }
                        // Get the end of the date period, add one to get a time in the next period, and then get the start of the next period
                        date = period.periodDefinition(new Date(period.periodDefinition(date)[1].getTime() + 1))[0];
                        dates.push(date);
                        //Desired behaviour that day 1 for a day is the current day
                        //Currently day 1 is next day.

                    }
                    targetDate = (periodDates.get(periodName) ?? [])[periodNumber - 1] ?? new Date(0);
                    if (targetDate.getTime() === 0) {
                        new Notice(`Could not determine target date for period: ${periodName} number: ${periodNumber}`);
                        content = content.replaceAll(match[0], '');
                        continue;
                    }
                }
                // targetDate is now set to the date of the period number specified in the template
                // Updates the template with the formatted date for the period number specified in the template
                const formattedDate = format(targetDate, dateFormat);
                content = content.replaceAll(match[0], formattedDate);
            }
        } catch (error) {
            new Notice(`Error processing template`);
            if (match) {
                content = content.replaceAll(match[0], '');
            }
        }
    }
    return content;
}

function extractPeriodStart(filename: string, filenameFormat: string): Date | null {
    const captures: string[] = [];
    const pattern = `^${filenameFormat
        .split(/(\/[^/]+\/)/)
        .map((part) => {
            if (!/^\/[^/]+\//.test(part)) {
                return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }

            const dateFormat = part.slice(1, -1);
            return dateFormat
                .replace(/yyyy/g, () => {
                    captures.push('year');
                    return '(\\d{4})';
                })
                .replace(/MM/g, () => {
                    captures.push('month');
                    return '(\\d{2})';
                })
                .replace(/dd/g, () => {
                    captures.push('day');
                    return '(\\d{2})';
                });
        })
        .join('')}$`;
    const match = new RegExp(pattern).exec(filename);
    if (!match) {
        return null;
    }

    const values = new Map(captures.map((name, index) => [name, match[index + 1]]));
    const year = Number(values.get('year'));
    const month = Number(values.get('month') ?? 1);
    const day = Number(values.get('day') ?? 1);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }

    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
        ? date
        : null;
}

async function ensureFolder(plugin: AutoFormatter, folderPath: string): Promise<void> {
    let path = '';
    for (const part of folderPath.split('/').filter(Boolean)) {
        path = path ? `${path}/${part}` : part;
        if (!plugin.app.vault.getAbstractFileByPath(path)) {
            await plugin.app.vault.createFolder(path);
        }
    }
}

function getUniquePath(plugin: AutoFormatter, path: string): string {
    if (!plugin.app.vault.getAbstractFileByPath(path)) return path;
    const extension = '.md';
    const basePath = path.slice(0, -extension.length);
    let suffix = 1;
    while (plugin.app.vault.getAbstractFileByPath(`${basePath} (${suffix})${extension}`)) suffix++;
    return `${basePath} (${suffix})${extension}`;
}

// Moves all files of a period beofre a date
async function cleanOldFiles(plugin: AutoFormatter, currentFolder: TFolder, period: Period, currentDate: Date): Promise<void> {
    const files = currentFolder.children.filter((file): file is TFile => file instanceof TFile);
    for (const file of files) {
        const fileStart = extractPeriodStart(file.basename, period.filenameFormat);
        if (!fileStart) {
            continue;
        }
        //console.log("Checking file: " + file.basename + " with start date: " + fileStart.toISOString() + " against period: " + period.name + " with start date: " + period.periodDefinition(currentDate)[0].toISOString());
        //console.log(fileStart.getTime() - period.periodDefinition(currentDate)[0].getTime())
        if (fileStart.getTime() > period.periodDefinition(currentDate)[0].getTime() - 100) {
            continue;
        }

        const archivePath = period.archivePath.startsWith('/')
            ? format(fileStart, period.archivePath).replace(/^\/+|\/+$/g, '')
            : `${plugin.settings.archiveFolderPath}/${format(fileStart, period.archivePath).replace(/^\/+|\/+$/g, '')}`;

        await ensureFolder(plugin, archivePath);
        await plugin.app.vault.rename(file, getUniquePath(plugin, `${archivePath}/${file.basename}.md`));
    }
}

async function generatePeriodFile(plugin: AutoFormatter, currentFolder: TFolder, template: TFile, period: Period, currentDate: Date): Promise<void> {
    // Checks if period file already exist
    const [periodStart] = period.periodDefinition(currentDate);
    const currentName = period.filenameFormat.replace(
        /\/([^/]+)\//g,
        (_match, dateFormat: string) => format(periodStart, dateFormat),
    );
    const files = currentFolder.children
    for (const child of files) {
        if ((child instanceof TFile) && child.name === `${currentName}.md`) {
            return;
        }
    }
    const content = await plugin.app.vault.read(template);
    const formattedContent = formatTemplate(content, periodStart, plugin.settings.periods);
    await plugin.app.vault.create(`${currentFolder.path}/${currentName}.md`, formattedContent);

}
export async function updateCurrent(plugin: AutoFormatter, date = new Date(), daysAhead = 1): Promise<void> {
    // Checks that the settings are sensible
    const currentFolder = plugin.app.vault.getAbstractFileByPath(plugin.settings.currentFolderPath);
    if (!(currentFolder instanceof TFolder)) {
        new Notice(`Current folder misconfigured: ${plugin.settings.currentFolderPath}`)
        return;
    }

    const archiveFolder = plugin.app.vault.getAbstractFileByPath(plugin.settings.archiveFolderPath);
    if (!(archiveFolder instanceof TFolder)) {
        new Notice(`Archive folder misconfigured: ${plugin.settings.archiveFolderPath}`)
        return;
    }



    for (const period of plugin.settings.periods) {
        // Checks that the period is valid
        const templatePath = period.templatePath.endsWith('.md') ? period.templatePath : `${period.templatePath}.md`;

        const file = plugin.app.vault.getAbstractFileByPath(templatePath);
        if (!(file instanceof TFile)) {
            new Notice(`Template file not found: ${templatePath}`);
            continue;
        }
        cleanOldFiles(plugin, currentFolder, period, date).catch((error) => {
            new Notice(`Error cleaning old files for period ${period.name}: ${error}`);
        });
        let dateToGenerate = new Date(date.getTime());
        for (let i = 0; i < daysAhead; i++) {
            generatePeriodFile(plugin, currentFolder, file, period, dateToGenerate).catch((error) => {
                new Notice(`Error generating period file for period ${period.name}: ${error}`);
            });
            dateToGenerate.setDate(dateToGenerate.getDate() + 1);
        }
    }
}
