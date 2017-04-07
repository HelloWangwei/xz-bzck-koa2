const mongodb = require('./../../orm/mongodb');
const elasticSearch = require('./../../orm/elasticsearch');
const moment = require('moment');
const db_name = 'xz_sys';
const coll_name = 'user_topic';

const db_name2 = 'xz';
const coll_log = 'log';

/*专题定制初始化*/
exports.getUserTopic = async (ctx) => {
    let userId = ctx.request.body.userid;
    let mongoQuery = {userid: userId};
    let userTopics = await mongodb.find(db_name, coll_name, mongoQuery, null);
    let websiteInit = [];
    let res = [];

    userTopics = userTopics ? userTopics : [];
    for (let [index, userTopic] of new Map(userTopics.map((userTopic, index) => [index, userTopic]))) {
        let websites = userTopic.website;
        let cores = [];
        let importants = [];
        let normals = [];

        let website_urls = [];

        for (let website of websites) {
            if ('core' == website.level) {
                cores.push(website);
            } else if ('important' == website.level) {
                importants.push(website);
            } else {
                normals.push(website);
            }
            if (index == 0) {
                websiteInit.push(website.url);
            }
            website_urls.push(website.url);
        }
        delete userTopic._id;
        delete userTopic.order;
        let yesterday = moment().add(-1, 'days').format('YYYY-MM-DD');
        let today = moment().format('YYYY-MM-DD');

        let urlQuery = [];
        for (let website_url of website_urls) {
            urlQuery.push({match: {website_url: website_url}});
        }
        /*获取专题定制更新数量*/
        let query = {
            query: {
                bool: {
                    must: [
                        {
                            bool: {
                                should: urlQuery
                            }
                        },
                        {
                            range: {
                                current_time: {
                                    gte: yesterday,
                                    lte: today
                                }
                            }
                        }
                    ]
                }
            }
        };
        userTopic.location = userTopic.location ? userTopic.location : [];
        userTopic.organization = userTopic.organization ? userTopic.organization : [];
        userTopic.program = userTopic.program ? userTopic.program : [];
        userTopic.person = userTopic.person ? userTopic.person : [];
        userTopic.tech = userTopic.tech ? userTopic.tech : [];
        userTopic.country = userTopic.country ? userTopic.country : [];
        /*当六大类中某一类存在时 以六大类作为过滤条件*/
        if (userTopic.location.length + userTopic.organization.length + userTopic.program.length +
            userTopic.person.length + userTopic.tech.length + userTopic.country.length > 0) {
            query.query.bool.filter = {
                bool: {
                    must: {
                        bool: {
                            should: [
                                {terms: {location: userTopic.location}},
                                {terms: {organization: userTopic.organization}},
                                {terms: {program: userTopic.program}},
                                {terms: {person: userTopic.person}},
                                {terms: {tech: userTopic.tech}},
                                {terms: {country: userTopic.country}}
                            ]
                        }
                    }
                }
            }
        }
        let result = await elasticSearch.search(query, null, null, 0);
        userTopic.num = result.total;
        websites = {cores: cores, importants: importants, normals: normals};
        userTopic.website = websites;
    }

    let location;
    let organization;
    let program;
    let person;
    let tech;
    let country;
    if (userTopics.length > 0) {
        location = userTopics[0].location;
        organization = userTopics[0].organization;
        program = userTopics[0].program;
        person = userTopics[0].person;
        tech = userTopics[0].tech;
        country = userTopics[0].country;
    } else {
        location = [];
        organization = [];
        program = [];
        person = [];
        tech = [];
        country = [];
    }

    let urlInitQuery = [];
    for (let web of websiteInit) {
        urlInitQuery.push({match: {website_url: web}});
    }
    /*获取初始化info信息*/
    let query = {
        query: {
            bool: {
                must: {
                    bool: {
                        should: urlInitQuery
                    }
                }
            }
        }
    };
    /*当六大类中 某一类不为空时  以六大类作为过滤条件*/
    if (location.length + organization.length + program.length + person.length + tech.length + country.length > 0) {
        query.query.bool.filter = {
            bool: {
                must: {
                    bool: {
                        should: [
                            {terms: {location: location}},
                            {terms: {organization: organization}},
                            {terms: {program: program}},
                            {terms: {person: person}},
                            {terms: {tech: tech}},
                            {terms: {country: country}}
                        ]
                    }
                }
            }
        };
    }
    let result = await elasticSearch.search(query, null, 20, 0);
    for (let hit of result.hits) {
        let info = hit._source;
        delete info.content;
        delete info.related;
        res.push(info);
    }
    ctx.response.status = 200;
    ctx.response.body = {res: res, userTopics: userTopics, total: result.total};
};

/*专题定制、专题订阅的导出方法*/
exports.exportTopics = async (ctx) => {
    let website_urls = [];
    let webCores = [];
    let webImportants = [];
    let webNoramls = [];
    let query;
    let total = 0;
    let res = {title: [], data: []};

    let body = ctx.request.body;
    let page = body.page;
    let forbids = [];
    let sticks = [];

    if (body.topic) {
        forbids = body.topic.forbidID ? body.topic.forbidID : [];
        sticks = body.topic.stick ? body.topic.stick : [];
    }
    let sort;

    let size = body.size;

    let cores = [];
    let importants = [];
    let normals = [];

    if (body.checkedParams.core != undefined) {
        for (let core of body.checkedParams.core) {
            cores.push(core.url);
            website_urls.push(core.url);
            if (core.flag == '1') {
                if (core.url.substring(0, 5) == 'https') {
                    webCores.push(core.url.substring(0, core.url.indexOf('/', 8) == -1 ? core.url.length : core.url.indexOf('/', 8)));
                } else if (core.url.substring(0, 4) == 'http') {
                    webCores.push(core.url.substring(0, core.url.indexOf('/', 7) == -1 ? core.url.length : core.url.indexOf('/', 7)));
                } else {
                    webCores.push(core.url.substring(0, core.url.indexOf('/') == -1 ? core.url.length : core.url.indexOf('/')));
                }
            } else {
                webCores.push(core.url);
            }
        }
    }
    if (body.checkedParams.important != undefined) {
        for (let important of body.checkedParams.important) {
            importants.push(important.url);
            website_urls.push(important.url);
            if (important.flag == '1') {
                if (important.url.substring(0, 5) == 'https') {
                    webImportants.push(important.url.substring(0, important.url.indexOf('/', 8) == -1 ? important.url.length : important.url.indexOf('/', 8)));
                } else if (important.url.substring(0, 4) == 'http') {
                    webImportants.push(important.url.substring(0, important.url.indexOf('/', 7) == -1 ? important.url.length : important.url.indexOf('/', 7)));
                } else {
                    webImportants.push(important.url.substring(0, important.url.indexOf('/') == -1 ? important.length : important.url.indexOf('/')));
                }
            } else {
                webImportants.push(important.url);
            }
        }
    }
    if (body.checkedParams.normal != undefined) {
        for (let normal of body.checkedParams.normal) {
            normals.push(normal.url);
            website_urls.push(normal.url);
            if (normal.flag == '1') {
                if (normal.url.substring(0, 5) == 'https') {
                    webNoramls.push(normal.url.substring(0, normal.url.indexOf('/', 8) == -1 ? normal.url.length : normal.url.indexOf('/', 8)));
                } else if (normal.url.substring(0, 4) == 'http') {
                    webNoramls.push(normal.url.substring(0, normal.url.indexOf('/', 7) == -1 ? normal.url.length : normal.url.indexOf('/', 7)));
                } else {
                    webNoramls.push(normal.url.substring(0, normal.url.indexOf('/') == -1 ? normal.url.length : normal.url.indexOf('/')));
                }
            } else {
                webNoramls.push(normal.url);
            }
        }
    }
    let urlQuery = [];
    /*通过level筛选*/
    if (body.siteSortObj.coreLevel == undefined || body.siteSortObj.coreLevel.trim() == '') {
        for (let website_url of website_urls) {
            urlQuery.push({match: {website_url: website_url}});
        }
    } else if (body.siteSortObj.coreLevel == 'core') {
        for (let website_url of webCores) {
            urlQuery.push({match: {website_url: website_url}});
        }
    } else if (body.siteSortObj.coreLevel == 'important') {
        for (let website_url of webImportants) {
            urlQuery.push({match: {website_url: website_url}});
        }
    } else {
        for (let website_url of webNoramls) {
            urlQuery.push({match: {website_url: website_url}});
        }
    }
    if (body.siteSortObj.start == undefined || body.siteSortObj.start.trim() == '') {
        body.siteSortObj.start = '1990-01-01';
    }
    if (body.siteSortObj.end == undefined || body.siteSortObj.end.trim() == '') {
        body.siteSortObj.end = moment().format('YYYY-MM-DD');
    }
    body.checkedParams.location = body.checkedParams.location ? body.checkedParams.location : [];
    body.checkedParams.organization = body.checkedParams.organization ? body.checkedParams.organization : [];
    body.checkedParams.program = body.checkedParams.program ? body.checkedParams.program : [];
    body.checkedParams.person = body.checkedParams.person ? body.checkedParams.person : [];
    body.checkedParams.tech = body.checkedParams.tech ? body.checkedParams.tech : [];
    body.checkedParams.country = body.checkedParams.country ? body.checkedParams.country : [];
    if (urlQuery.length) {
        query = {
            query: {
                bool: {
                    must: [
                        {
                            bool: {
                                should: urlQuery
                            }
                        },
                        {
                            range: {
                                current_time: {
                                    gte: body.siteSortObj.start,
                                    lte: body.siteSortObj.end
                                }
                            }
                        }
                    ],
                    must_not: {
                        terms: {
                            id: forbids
                        }
                    }
                }
            },
            sort: {
                _script: {
                    script: JSON.stringify(sticks) + ".contains(doc['id'].value)?1:2",
                    type: "number",
                    order: "asc"
                }
            }
        };
        if (body.checkedParams.location.length + body.checkedParams.organization.length + body.checkedParams.program.length +
            body.checkedParams.person.length + body.checkedParams.tech.length + body.checkedParams.country.length > 0) {
            query.query.bool.filter = {
                bool: {
                    must: {
                        bool: {
                            should: [{terms: {location: body.checkedParams.location}},
                                {terms: {organization: body.checkedParams.organization}},
                                {terms: {program: body.checkedParams.program}},
                                {terms: {person: body.checkedParams.person}},
                                {terms: {tech: body.checkedParams.tech}},
                                {terms: {country: body.checkedParams.country}}]
                        }
                    }
                }
            }
        }
        /*通过关键字查询*/
        if (body.siteSortObj.keyword != undefined && body.siteSortObj.keyword.trim() != '') {
            query.query.bool.must.push({
                multi_match: {
                    query: body.siteSortObj.keyword,
                    operator: 'AND',
                    fields: ["title", "content"]
                }
            });
        }
        sort = "current_time:" + body.siteSortObj.timeSort;

        /*网站排序*/
        if (body.siteSortObj.timeSort != undefined && body.siteSortObj.timeSort == 'siteSort') {
            let scriptQuery = "if(" + JSON.stringify(sticks) + ".contains(doc['id'].value)){return 0}"
                + "else if(" + JSON.stringify(webCores) + ".contains(doc['website_url'].value)){return 1}"
                + "else if(" + JSON.stringify(webImportants) + ".contains(doc['website_url'].value)){return 2}"
                + "else if(" + JSON.stringify(webNoramls) + ".contains(doc['website_url'].value)){return 3}"
                + "else{return 4}";
            query.sort = {
                _script: {
                    script: scriptQuery,
                    type: 'number',
                    order: 'asc'
                }
            };
        }

        let result = await elasticSearch.search(query, sort, size, 0);
        let title = [];
        for (let [index, hit] of new Map(result.hits.map((hit, index) => [index, hit]))) {
            let info = hit._source;
            let data = [];
            if (index == 0) {
                for (let key in info) {
                    if (key != '_id') {
                        title.push(
                            {
                                value: key,
                                type: 'ROW_HEADER_HEADER',
                                datatype: 'string'
                            }
                        );
                    }
                }
            }
            for (let key of title) {
                let value = info[key.value];
                if (typeof value == "string") {
                    value = value.replace(/<[^>]+>/g, "");
                }
                data.push({
                    value: value,
                    type: 'ROW_HEADER'
                });
            }
            res.data.push(data);
        }
        res.title = title;
        total = result.hits.length;
    }
    ctx.response.status = 200;
    ctx.response.body = {res: res, total: total};
};
/*专题定制 筛选 翻页等方法*/
exports.getInfoByTopic = async (ctx) => {
    let website_urls = [];
    let webCores = [];
    let webImportants = [];
    let webNoramls = [];
    let query;

    let res = [];

    let body = ctx.request.body;
    let page = body.page;
    let sort;
    let total = 0;
    let cores = [];
    let importants = [];
    let normals = [];

    if (page == undefined || page.toString().trim() == '') {
        page = 1;
    }
    if (body.checkedParams.core != undefined) {
        for (let core of body.checkedParams.core) {
            cores.push(core.url);
            website_urls.push(core.url);
            if (core.flag == '1') {
                if (core.url.substring(0, 5) == 'https') {
                    webCores.push(core.url.substring(0, core.url.indexOf('/', 8) == -1 ? core.url.length : core.url.indexOf('/', 8)));
                } else if (core.url.substring(0, 4) == 'http') {
                    webCores.push(core.url.substring(0, core.url.indexOf('/', 7) == -1 ? core.url.length : core.url.indexOf('/', 7)));
                } else {
                    webCores.push(core.url.substring(0, core.url.indexOf('/') == -1 ? core.url.length : core.url.indexOf('/')));
                }
            } else {
                webCores.push(core.url);
            }
        }
    }
    if (body.checkedParams.important != undefined) {
        for (let important of body.checkedParams.important) {
            importants.push(important.url);
            website_urls.push(important.url);
            if (important.flag == '1') {
                if (important.url.substring(0, 5) == 'https') {
                    webImportants.push(important.url.substring(0, important.url.indexOf('/', 8) == -1 ? important.url.length : important.url.indexOf('/', 8)));
                } else if (important.url.substring(0, 4) == 'http') {
                    webImportants.push(important.url.substring(0, important.url.indexOf('/', 7) == -1 ? important.url.length : important.url.indexOf('/', 7)));
                } else {
                    webImportants.push(important.url.substring(0, important.url.indexOf('/') == -1 ? important.length : important.url.indexOf('/')));
                }
            } else {
                webImportants.push(important.url);
            }
        }
    }
    if (body.checkedParams.normal != undefined) {
        for (let normal of body.checkedParams.normal) {
            normals.push(normal.url);
            website_urls.push(normal.url);
            if (normal.flag == '1') {
                if (normal.url.substring(0, 5) == 'https') {
                    webNoramls.push(normal.url.substring(0, normal.url.indexOf('/', 8) == -1 ? normal.url.length : normal.url.indexOf('/', 8)));
                } else if (normal.url.substring(0, 4) == 'http') {
                    webNoramls.push(normal.url.substring(0, normal.url.indexOf('/', 7) == -1 ? normal.url.length : normal.url.indexOf('/', 7)));
                } else {
                    webNoramls.push(normal.url.substring(0, normal.url.indexOf('/') == -1 ? normal.url.length : normal.url.indexOf('/')));
                }
            } else {
                webNoramls.push(normal.url);
            }
        }
    }
    /*通过level筛选*/
    let urlQuerys = [];
    if (body.siteSortObj.coreLevel == undefined || body.siteSortObj.coreLevel.trim() == '') {
        for (let website_url of website_urls) {
            urlQuerys.push({match: {website_url: website_url}});
        }
    } else if (body.siteSortObj.coreLevel == 'core') {
        for (let website_url of webCores) {
            urlQuerys.push({match: {website_url: website_url}});
        }
    } else if (body.siteSortObj.coreLevel == 'important') {
        for (let website_url of webImportants) {
            urlQuerys.push({match: {website_url: website_url}});
        }
    } else {
        for (let website_url of webNoramls) {
            urlQuerys.push({match: {website_url: website_url}});
        }
    }
    if (urlQuerys.length) {
        if (body.siteSortObj.start == undefined || body.siteSortObj.start.trim() == '') {
            body.siteSortObj.start = '1990-01-01';
        }
        if (body.siteSortObj.end == undefined || body.siteSortObj.end.trim() == '') {
            body.siteSortObj.end = moment().format('YYYY-MM-DD');
        }
        body.checkedParams.location = body.checkedParams.location ? body.checkedParams.location : [];
        body.checkedParams.organization = body.checkedParams.organization ? body.checkedParams.organization : [];
        body.checkedParams.program = body.checkedParams.program ? body.checkedParams.program : [];
        body.checkedParams.person = body.checkedParams.person ? body.checkedParams.person : [];
        body.checkedParams.tech = body.checkedParams.tech ? body.checkedParams.tech : [];
        body.checkedParams.country = body.checkedParams.country ? body.checkedParams.country : [];
        query = {
            query: {
                bool: {
                    must: [
                        {
                            bool: {
                                should: urlQuerys
                            }
                        },
                        {
                            range: {
                                current_time: {
                                    gte: body.siteSortObj.start,
                                    lte: body.siteSortObj.end
                                }
                            }
                        }
                    ]
                }
            }
        };
        /*六大类筛选*/
        if (body.checkedParams.location.length + body.checkedParams.organization.length + body.checkedParams.program.length +
            body.checkedParams.person.length + body.checkedParams.tech.length + body.checkedParams.country.length > 0) {
            query.query.bool.filter = {
                bool: {
                    must: {
                        bool: {
                            should: [{terms: {location: body.checkedParams.location}},
                                {terms: {organization: body.checkedParams.organization}},
                                {terms: {program: body.checkedParams.program}},
                                {terms: {person: body.checkedParams.person}},
                                {terms: {tech: body.checkedParams.tech}},
                                {terms: {country: body.checkedParams.country}}]
                        }
                    }
                }
            }
        }
        /*关键字查询*/
        if (body.siteSortObj.keyword != undefined && body.siteSortObj.keyword.trim() != '') {
            query.query.bool.must.push({
                multi_match: {
                    query: body.siteSortObj.keyword,
                    operator: 'AND',
                    fields: ["title", "content"]
                }
            });
            query.highlight = {
                require_field_match: true,
                fields: {title: {pre_tags: ["<b style=\"color: red; \">"], post_tags: ["</b>"]}}
            };
        }
        sort = "current_time:" + body.siteSortObj.timeSort;

        /*网站排序*/
        if (body.siteSortObj.timeSort != undefined && body.siteSortObj.timeSort == 'siteSort') {
            let scriptQuery = "if(" + JSON.stringify(webCores) + ".contains(doc['website_url'].value)){return 0}"
                + "else if(" + JSON.stringify(webImportants) + ".contains(doc['website_url'].value)){return 1}"
                + "else if(" + JSON.stringify(webNoramls) + ".contains(doc['website_url'].value)){return 2}"
                + "else{return 3}";
            query.sort = {
                _script: {
                    script: scriptQuery,
                    type: 'number',
                    order: 'asc'
                }
            };
        }
        let result = await elasticSearch.search(query, sort, 20, page * 20 - 20);
        for (let hit of result.hits) {
            let info = hit._source;
            delete info['related'];
            delete info['content'];
            if (hit.highlight != undefined) {
                info.title = hit.highlight.title[0];
            }
            res.push(info);
        }
        total = result.total;
    }
    ctx.response.status = 200;
    ctx.response.body = {res: res, total: total};
};
