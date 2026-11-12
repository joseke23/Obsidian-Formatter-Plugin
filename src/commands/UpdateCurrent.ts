import { Notice, TFolder, TFile } from 'obsidian';
import AutoFormatter from '../main.js';
import type { Period } from '../settings.js';
import { format } from 'date-fns';
/* 
The basic thing 
- Moves all "old" files to the old folder
- Creates new files based on the templates if they don't exist
Sequentially for each period

If i were to refactor it
- Generalise the period handling
    - Template path, Name, Folder Path, Period definition

The formatter works based on auto generating the template. 
It has the format with which each period is specified and then has the period name.
Numbers are for numbers within a period

The formatter uses {{[PeriodName] [Period Number]: [Format]}} to specify the format of the period.
The period number is the number of the period in relation to the current period. 
The format is the format replaced by with iso standard so yyyy-MM-dd gets replaced with 2023-01-01.
*/
export async function handlePeriod(plugin: AutoFormatter, period: Period, current: Date): Promise<void> {
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

    const [periodStart] = period.periodDefinition(current);
    const currentName = period.filenameFormat.replace(
        /\/([^/]+)\//g,
        (_match, dateFormat: string) => format(periodStart, dateFormat),
    );
    const files = currentFolder.children.filter(
        (child): child is TFile => {
            if (!(child instanceof TFile) || child.extension !== 'md') {
                return false;
            }
            return extractPeriodStart(child.basename, period.filenameFormat) !== null;
        },
    );

    for (const file of files) {
        if (file.basename === currentName) {
            continue;
        }

        const fileStart = extractPeriodStart(file.basename, period.filenameFormat);
        if (!fileStart) {
            continue;
        }

        const archivePath = period.archivePath.startsWith('/')
            ? format(fileStart, period.archivePath).replace(/^\/+|\/+$/g, '')
            : `${plugin.settings.archiveFolderPath}/${format(fileStart, period.archivePath).replace(/^\/+|\/+$/g, '')}`;

        await ensureFolder(plugin, archivePath);
        await plugin.app.vault.rename(file, getUniquePath(plugin, `${archivePath}/${file.basename}.md`));
    }

    const currentPath = `${currentFolder.path}/${currentName}.md`;
    if (plugin.app.vault.getAbstractFileByPath(currentPath)) {
        return;
    }
    const templatePath = period.templatePath.endsWith('.md') ? period.templatePath : `${period.templatePath}.md`;
    const template = plugin.app.vault.getAbstractFileByPath(templatePath);
    if (!(template instanceof TFile)) {
        new Notice(`${period.name} template misconfigured: ${period.templatePath}`);
        return;
    }

    const content = await plugin.app.vault.read(template);
    const file = await plugin.app.vault.create(currentPath, content);
    await formatTemplate(plugin, file.path, periodStart);
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

export async function formatTemplate(plugin: AutoFormatter, filePath: string, periodStart: Date): Promise<boolean> {
    try {
        const file = plugin.app.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof TFile)) {
            new Notice(`Template file not found: ${filePath}`);
            return false;
        }
        let periodDates = new Map<string, Date[]>();
        const periodNames = plugin.settings.periods
            .map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');
        const regex = new RegExp(
            `\\{\\{(${periodNames})\\s+(-?\\d+):\\s*([^}]+)\\}\\}`,
        );

        await plugin.app.vault.process(file, (content) => {
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
                    const period = plugin.settings.periods.find((p) => p.name === periodName);
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
                        }
                        // Checks if targetDate is already set
                        if (targetDate !== new Date(0)) {
                            console.log(`Calculating cached date for period: ${periodName} number: ${periodNumber}`);
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
                    new Notice(`Error processing template: ${error}`);
                    if (match) {
                        content = content.replaceAll(match[0], '');
                    }
                }
            }

            return content;
        });
        return true;
    } catch (error) {
        new Notice(`Error formatting template: ${error}`);
        return false;
    }
}

export async function updateCurrent(plugin: AutoFormatter): Promise<void> {


    for (const period of plugin.settings.periods) {
        console.log(`Handling period: ${period.name}`);
        await handlePeriod(plugin, period, new Date());
    }
}