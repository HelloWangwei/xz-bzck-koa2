const mongodb = require('./../../orm/mongodb');
const db_name = 'xz_sys';
const coll_name = 'wiki';


const rp = require('request-promise');
const cheerio = require('cheerio');

exports.pageSearch = async (ctx) => {
    let keyword = ctx.request.body.keyword;
    let htmlContent = '';
    let title = '';

    let query = {keyword: keyword.toLowerCase()};
    let res = await mongodb.find(db_name, coll_name, query, null);

    if (res.length <= 0) {
        let html = await rp({
            uri: 'https://en.wikipedia.org/wiki/' + keyword,
            headers: {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'}
        });
        let $ = cheerio.load(html);

        title = $.html('#firstHeading');
        let content = $.html('#mw-content-text');
        if (content != null && content != '') {
            htmlContent = content;
        }
        let insert = {title: title, html: htmlContent, keyword: keyword.toLowerCase()};
        await mongodb.insert(db_name, coll_name, insert);
    } else {
        htmlContent = res[0].html;
        title = res[0].title;
    }

    ctx.response.status = 200;
    ctx.response.body = {body: htmlContent, title: title};

};

