import * as fs from 'fs';
import * as path from 'path';

export const loadWebView = () => {

    let htmlView = fs
        .readFileSync(path.join(__dirname, 'web', 'index.html'))
        .toString();

    const jqueryScript = fs
        .readFileSync(path.join(__dirname, 'web', 'jquery-3.7.0.min.js'))
        .toString();

    const indexScript = fs
        .readFileSync(path.join(__dirname, 'web', 'index.js'))
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
        '<link rel="stylesheet" href="index.css">',
        `<style>\n${styleCss}\n</style>`
    );

    return htmlView;
};