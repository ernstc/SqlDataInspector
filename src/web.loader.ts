import * as fs from 'fs';
import * as path from 'path';

export const loadWebView = () => {

    let htmlView = fs
        .readFileSync(path.join(__dirname, 'web', 'index.html'))
        .toString();

    const jqueryScript = fs
        .readFileSync(path.join(__dirname, 'web', 'jquery-3.6.0.min.js'))
        .toString();

    const indexScript = fs
        .readFileSync(path.join(__dirname, 'web', 'index.js'))
        .toString();
    
    const iconsCss = fs
        .readFileSync(path.join(__dirname, 'web', 'fabric-icons-inline.css'))
        .toString();
    
    const styleCss = fs
        .readFileSync(path.join(__dirname, 'web', 'index.css'))
        .toString();

    htmlView = htmlView.replace(
        '<!-- JQUERY PLACEHOLDER -->',
        `<script>${jqueryScript}</script>`
    );

    htmlView = htmlView.replace(
        '<!-- INDEX.JS PLACEHOLDER -->',
        `<script>${indexScript}</script>`
    );

    htmlView = htmlView.replace(
        '<!-- ICONS CSS PLACEHOLDER -->',
        `<style>\n${iconsCss}\n</style>`
    );

    htmlView = htmlView.replace(
        '<!-- CSS PLACEHOLDER -->',
        `<style>\n${styleCss}\n</style>`
    );

    return htmlView;
};