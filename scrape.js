import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { LOGINURL, COMPTIMESHEETURL } from './secret.js';
import { executablePath } from 'puppeteer';
import { setTimeout } from 'node:timers/promises';

puppeteer.use(StealthPlugin());

export const scrapeData = async (EMAIL, PASSWORD) => {
    const browser = await puppeteer.launch({ headless: true, executablePath: executablePath() });
    const page = await browser.newPage();

    try {
        await page.goto(LOGINURL, { waitUntil: 'networkidle2' });
        await page.type('input[name="uname"]', EMAIL);
        await page.type('input[name="pass"]', PASSWORD);
        await Promise.all([
            page.click('input.submit-login'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        await setTimeout(2000);
        await page.goto(COMPTIMESHEETURL, { waitUntil: 'networkidle2' });

        await page.waitForFunction(() => {
            const tables = document.querySelectorAll('table#product-table');
            return tables.length > 0;
        }, { timeout: 10000 });

        const tableContents = await page.evaluate(() => {
            const tables = document.querySelectorAll('table#product-table');
            const tableContents = [];
            tables.forEach((table, index) => {
                tableContents.push({
                    index: index + 1,
                    content: table.innerHTML
                });
            });
            return tableContents;
        });

        if (tableContents.length > 0) {
            const firstTableContent = tableContents[0].content;

            const tableContent = await page.evaluate((firstTableContent) => {
                const table = document.createElement('table');
                table.innerHTML = firstTableContent;

                const rows = table.querySelectorAll('tr');

                const extractHoursAndMinutes = (str) => {
                    const regex = /(\d+)\s*hrs,\s*(\d+)\s*min/;
                    const match = str.match(regex);
                    if (match) {
                        const hours = parseInt(match[1]);
                        const minutes = parseInt(match[2]);
                        return { hours, minutes };
                    }
                    return null;
                };

                let totalExtraMinutes = 0;

                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    cells.forEach(cell => {
                        const text = cell.textContent.trim();
                        const time = extractHoursAndMinutes(text);
                        if (time) {
                            if (time.hours > 8) {
                                totalExtraMinutes += ((time.hours - 8) * 60) + time.minutes;
                            } else if (time.hours < 8) {
                                totalExtraMinutes -= ((8 - time.hours) * 60) - time.minutes;
                            } else {
                                totalExtraMinutes += time.minutes;
                            }
                        }
                    });
                });

                let totalHours = Math.floor(totalExtraMinutes / 60);
                let remainingMinutes = totalExtraMinutes % 60;

                if (totalHours < 0) {
                    totalHours += 1;
                }
                return { totalHours, totalMinutes: remainingMinutes };
            }, firstTableContent);

            return tableContent.totalHours < 0
                ? `Lagged By: ${tableContent.totalHours} Hours, ${tableContent.totalMinutes} Minutes`
                : `Ahead By: ${tableContent.totalHours} Hours, ${tableContent.totalMinutes} Minutes`;
        } else {
            return 'No table found with id="product-table"';
        }
    } catch (error) {
        throw new Error(`Error: ${error.message}`);
    } finally {
        await browser.close();
    }
};
