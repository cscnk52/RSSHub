import { namespaces } from '../../lib/registry';
import fs from 'node:fs';
import path from 'node:path';
import { categories } from './data';
import { getCurrentPath } from '../../lib/utils/helpers';

const fullTests = await (await fetch('https://raw.githubusercontent.com/DIYgod/RSSHub/gh-pages/build/test-full-routes.json')).json();
const testResult = fullTests.testResults[0].assertionResults;

const __dirname = getCurrentPath(import.meta.url);

// should sync with Namespace and Route
const languageList = ['zh', 'zh-tw', 'ja'];

const docs = {};

for (const namespace in namespaces) {
    let defaultCategory = namespaces[namespace].categories?.[0];
    if (!defaultCategory) {
        for (const path in namespaces[namespace].routes) {
            if (namespaces[namespace].routes[path].categories) {
                defaultCategory = namespaces[namespace].routes[path].categories[0];
                break;
            }
        }
    }
    if (!defaultCategory) {
        defaultCategory = 'other';
    }
    for (const path in namespaces[namespace].routes) {
        const realPath = `/${namespace}${path}`;
        const data = namespaces[namespace].routes[path];
        const categories = data.categories || namespaces[namespace].categories || [defaultCategory];
        // docs.json
        for (const category of categories) {
            if (!docs[category]) {
                docs[category] = {};
            }
            if (!docs[category][namespace]) {
                docs[category][namespace] = {
                    routes: {},
                };
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { routes: _, ...rest } = namespaces[namespace];
            docs[category][namespace] = { ...docs[category][namespace], ...rest };
            docs[category][namespace].routes[realPath] = data;
        }
    }
}

// Generate markdown
const pinyinCompare = new Intl.Collator('zh-Hans-CN-u-co-pinyin').compare;
const isASCII = (str) => /^[\u0000-\u007F]*$/.test(str);

function generateMd(lang) {
    const md = {};
    for (const category in docs) {
        const nameObj = categories.find((c) => c.link.includes(category));
        if (!nameObj) {
            throw new Error(`Category not found: ${category}, please double check your spelling.`);
        }

        md[category] = `# ${`${nameObj.icon} ${nameObj[lang]}`}\n\n`;

        const namespaces = Object.keys(docs[category]).sort((a, b) => {
            const aname = docs[category][a].name[0];
            const bname = docs[category][b].name[0];
            const ia = isASCII(aname);
            const ib = isASCII(bname);
            if (ia && ib) {
                return aname.toLowerCase() < bname.toLowerCase() ? -1 : 1;
            } else if (ia || ib) {
                return ia > ib ? -1 : 1;
            } else {
                return pinyinCompare(aname, bname);
            }
        });
        for (const namespace of namespaces) {
            if (docs[category][namespace].name === 'Unknown') {
                docs[category][namespace].name = namespace;
            }

            const namespaceItemLang = docs[category][namespace];
            for (const key of Object.keys(namespaceItemLang)) {
                namespaceItemLang[key] = namespaceItemLang[lang]?.[key] || namespaceItemLang[key];
            }
            for (const la of languageList) {
                delete namespaceItemLang[la];
            }

            md[category] += `## ${namespaceItemLang.name} ${namespaceItemLang.url ? `<Site url="${namespaceItemLang.url}"/>` : ''}\n\n`;
            if (namespaceItemLang.description) {
                md[category] += `${namespaceItemLang.description}\n\n`;
            }

            const realPaths = Object.keys(docs[category][namespace].routes).sort((a, b) => {
                const aname = docs[category][namespace].routes[a].name[0];
                const bname = docs[category][namespace].routes[b].name[0];
                const ia = isASCII(aname);
                const ib = isASCII(bname);
                if (ia && ib) {
                    return aname.toLowerCase() < bname.toLowerCase() ? -1 : 1;
                } else if (ia || ib) {
                    return ia > ib ? -1 : 1;
                } else {
                    return pinyinCompare(aname, bname);
                }
            });

            const processedPaths = new Set();

            for (const realPath of realPaths) {
                const data = docs[category][namespace].routes[realPath];
                if (Array.isArray(data.path)) {
                    if (processedPaths.has(data.path[0])) {
                        continue;
                    }
                    processedPaths.add(data.path[0]);
                }

                const test = testResult.find((t) => t.title === realPath);
                const parsedTest = test
                    ? {
                          code: test.status === 'passed' ? 0 : 1,
                          message: test.failureMessages?.[0],
                      }
                    : undefined;

                const routeItemLang = data;
                for (const key of Object.keys(routeItemLang)) {
                    routeItemLang[key] = routeItemLang[lang]?.[key] || routeItemLang[key];
                }
                for (const la of languageList) {
                    delete routeItemLang[la];
                }

                md[category] += `### ${routeItemLang.name} ${routeItemLang.url || namespaceItemLang.url ? `<Site url="${routeItemLang.url || namespaceItemLang.url}" size="sm" />` : ''}\n\n`;
                md[category] += `<Route namespace="${namespace}" :data='${JSON.stringify(routeItemLang).replaceAll(`'`, '&#39;')}' :test='${JSON.stringify(parsedTest)?.replaceAll(`'`, '&#39;')}' />\n\n`;
                if (routeItemLang.description) {
                    md[category] += `${routeItemLang.description}\n\n`;
                }
            }
        }
    }
    fs.mkdirSync(path.join(__dirname, `../../assets/build/docs/${lang}`), { recursive: true });
    for (const category in md) {
        fs.writeFileSync(path.join(__dirname, `../../assets/build/docs/${lang}/${category}.md`), md[category]);
    }
}
generateMd('en');
generateMd('zh');
