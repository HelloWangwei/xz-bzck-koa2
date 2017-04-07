const mongodb = require('./../../orm/mongodb');
const elasticSearch = require('./../../orm/elasticsearch');
const moment = require('moment');
const db_name = 'xz_sys';
const coll_name1 = 'topic_template';
const coll_name2 = 'user';
const coll_event = 'topic_event';
const coll_knowledgedb = 'knowledgedb';

exports.getTopics = async (ctx) => {
    let userID = ctx.request.body.userID;
    let topics = await mongodb.find(db_name, coll_name1, null, null);
    let user = await mongodb.find(db_name, coll_name2, {id: userID}, null);
    user = user[0];
    let topicIds = user.userTopicId ? user.userTopicId : [];
    for (let topic of topics) {
        topic.userFlag = 0;
        for (let topicId of topicIds) {
            if (topicId == topic.id) {
                topic.userFlag = 1;
                break;
            }
        }
    }
    ctx.response.status = 200;
    ctx.response.body = {topics: topics};
};

exports.modifySubscriber = async (ctx) => {
    let body = ctx.request.body;
    let user = await mongodb.find(db_name, coll_name2, {id: body.userID}, null);
    user = user[0];
    let topicIds = user.userTopicId;
    if (body.userFlag == 1) {
        topicIds.push(body.topicID);
    } else {
        for (let [index, topicId] of new Map(topicIds.map((topicId, index) => [index, topicId]))) {
            if (body.topicID == topicId) {
                topicIds.splice(index, 1);
                break;
            }
        }
    }
    await mongodb.updateUser(db_name, coll_name2, {id: body.userID}, {$set: {userTopicId: topicIds}});
    ctx.response.status = 200;
};

/**
 * 专题订阅初始化方法
 */
exports.getUserSubscriber = async (ctx) => {
    let userID = ctx.request.body.userid;
    let topicID = ctx.request.body.topicID;

    /*获取用户订阅列表*/
    let userTopics = await getSubscriberList(userID);

    let websiteInit = [];
    let res = [];

    let i = 0;
    let flag = false;
    userTopics = userTopics ? userTopics : [];
    /*遍历用户订阅*/
    for (let [index, userTopic] of new Map(userTopics.map((userTopic, index) => [index, userTopic]))) {
        if (topicID && topicID == userTopic.id) {
            i = index;
            flag = true;
        }
        let websites = userTopic.website;
        let cores = [];
        let importants = [];
        let normals = [];

        let website_urls = [];
        /*给url的level分类 并创建初始化与获取更新数量的查询链接数组*/
        for (let website of websites) {
            if ('core' == website.level) {
                cores.push(website);
            } else if ('important' == website.level) {
                importants.push(website);
            } else {
                normals.push(website);
            }
            if (flag == true) {
                websiteInit.push(website.url);
            }
            if (!topicID && index == 0) {
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
        /*获取前一天到今天的更新数量*/
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
        /*当六大类中 有某个存在时 用六大类作为过滤条件*/
        // if (userTopic.location.length + userTopic.organization.length + userTopic.program.length +
        //     userTopic.person.length + userTopic.tech.length + userTopic.country.length > 0) {
        //     query.query.bool.filter = {
        //         bool: {
        //             must: {
        //                 bool: {
        //                     should: [
        //                         {terms: {location: userTopic.location}},
        //                         {terms: {organization: userTopic.organization}},
        //                         {terms: {program: userTopic.program}},
        //                         {terms: {person: userTopic.person}},
        //                         {terms: {tech: userTopic.tech}},
        //                         {terms: {country: userTopic.country}}
        //                     ]
        //                 }
        //             }
        //         }
        //     }
        // }
        let result = await elasticSearch.search(query, null, null, 0);
        userTopic.num = result.total;
        websites = {cores: cores, importants: importants, normals: normals};
        userTopic.website = websites;
        flag = false;
    }

    /*初始化页面 默认选中第一个订阅*/
    let location;
    let organization;
    let program;
    let person;
    let tech;
    let country;
    let forbids = [];
    let sticks = [];
    if (userTopics.length > 0) {
        location = userTopics[i].location;
        organization = userTopics[i].organization;
        program = userTopics[i].program;
        person = userTopics[i].person;
        tech = userTopics[i].tech;
        country = userTopics[i].country;
        forbids = userTopics[i].forbidID;
        sticks = userTopics[i].stick;
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
    /*获取初始化信息*/
    let query = {
        query: {
            bool: {
                must: {
                    bool: {
                        should: urlInitQuery
                    }
                },
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
    /*当六大类中 某一类不为空时 以六大类作为过滤条件*/
    // if (location.length + organization.length + program.length + person.length + tech.length + country.length > 0) {
    //     query.query.bool.filter = {
    //         bool: {
    //             must: {
    //                 bool: {
    //                     should: [
    //                         {terms: {location: location}},
    //                         {terms: {organization: organization}},
    //                         {terms: {program: program}},
    //                         {terms: {person: person}},
    //                         {terms: {tech: tech}},
    //                         {terms: {country: country}}
    //                     ]
    //                 }
    //             }
    //         }
    //     };
    // }
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

/*专题订阅的 筛选 以及 翻页等 调用方法*/
exports.getInfoBySubscriber = async (ctx) => {
    let website_urls = [];
    let webCores = [];
    let webImportants = [];
    let webNoramls = [];
    let query;

    let res = [];

    let body = ctx.request.body;
    let page = body.page;
    let forbids = body.topic.forbidID;
    let sticks = body.topic.stick;
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
    let urlQuery = [];
    /*以level对链接分类 当用户选中某个level时 调用*/
    if (body.siteSortObj.coreLevel == undefined || body.siteSortObj.coreLevel.trim() == '') {
        for (let website_url of website_urls) {
            urlQuery.push({match: {website_url: website_url}});
        }
    } else if (body.siteSortObj.coreLevel == 'core') {
        for (let website_url of cores) {
            urlQuery.push({match: {website_url: website_url}});
        }
    } else if (body.siteSortObj.coreLevel == 'important') {
        for (let website_url of importants) {
            urlQuery.push({match: {website_url: website_url}});
        }
    } else {
        for (let website_url of normals) {
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
        /*六大类 某一个不为空时  以之作为过滤条件*/
        // if (body.checkedParams.location.length + body.checkedParams.organization.length + body.checkedParams.program.length +
        //     body.checkedParams.person.length + body.checkedParams.tech.length + body.checkedParams.country.length > 0) {
        //     query.query.bool.filter = {
        //         bool: {
        //             must: {
        //                 bool: {
        //                     should: [{terms: {location: body.checkedParams.location}},
        //                         {terms: {organization: body.checkedParams.organization}},
        //                         {terms: {program: body.checkedParams.program}},
        //                         {terms: {person: body.checkedParams.person}},
        //                         {terms: {tech: body.checkedParams.tech}},
        //                         {terms: {country: body.checkedParams.country}}]
        //                 }
        //             }
        //         }
        //     }
        // }
        /*当存在关键字时  以关键字作为匹配条件  并在标题中将关键字标红*/
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

/*获取用户订阅专题*/
getSubscriberList = async (userID) => {
    let user = await mongodb.find(db_name, coll_name2, {id: userID}, null);
    if (user != undefined) {
        user = user[0];
        let topics = await mongodb.find(db_name, coll_name1, null, null);
        let topicIds = user.userTopicId;
        let userTopics = [];
        for (let topicId of topicIds) {
            for (let topic of topics) {
                if (topic.id == topicId) {
                    userTopics.push(topic);
                }
            }
        }
        return userTopics;
    }
    return [];
};

//专题树 根据id查询专题信息
exports.serchTopicById = async (ctx) => {
    //获取topicid
    let topicids = ctx.request.body.id;

    //根据topicid查询专题信息{$in:topicids}
    let query = {id: {$in: topicids}};
    let topics = await mongodb.find(db_name, coll_name1, query, null);

    let topictemplate = {
        country: [],
        forbidID: [],
        stick: [],
        location: [],
        organization: [],
        website: [],
        program: [],
        person: [],
        tech: []
    };
    for (let topic of topics) {
        if (topic.country.length > 0) {
            for (let data of topic.country) {
                topictemplate.country.push(data);
            }
        }
        if (topic.forbidID.length > 0) {
            for (let data of topic.forbidID) {
                topictemplate.forbidID.push(data);
            }
        }
        if (topic.stick.length > 0) {
            for (let data of topic.stick) {
                topictemplate.stick.push(data);
            }
        }
        if (topic.location.length > 0) {
            for (let data of topic.location) {
                topictemplate.location.push(data);
            }
        }
        if (topic.organization.length > 0) {
            for (let data of topic.organization) {
                topictemplate.organization.push(data);
            }
        }
        if (topic.website.length > 0) {
            for (let data of topic.website) {
                topictemplate.website.push(data);
            }
        }
        if (topic.program.length > 0) {
            for (let data of topic.program) {
                topictemplate.program.push(data);
            }
        }
        if (topic.person.length > 0) {
            for (let data of topic.person) {
                topictemplate.person.push(data);
            }
        }
        if (topic.tech.length > 0) {
            for (let data of topic.tech) {
                topictemplate.tech.push(data);
            }
        }
    }

    topics = topictemplate;

    let cores = [];
    let importants = [];
    let normals = [];

    //为网站分级
    let websites = topics.website;

    for (let website of websites) {
        if ('core' == website.level) {//核心
            cores.push(website);
        } else if ('important' == website.level) {//重要
            importants.push(website);
        } else {//一般
            normals.push(website);
        }
    }

    topics.num = 0;
    topics.website = {cores: cores, importants: importants, normals: normals};

    ctx.response.status = 200;
    ctx.response.body = {topics: topics};
};

exports.timeLine = async (ctx) => {
    let topicID = ctx.request.body.topicID;

    let query = {topicid: topicID};
    let res = {};

    let topicEvents = await mongodb.getTopicEvents(db_name, coll_event, query);
    if (topicEvents.length) {
        let minTime = topicEvents[0].time.substring(0, 4);
        let maxTime = moment().format('YYYY');
        let times = [];
        for (let i = parseInt(minTime); i <= parseInt(maxTime); i++) {
            times.push(i);
        }

        let events = [];
        let organizations = [];
        let procurements = [];
        let equipment = new Set();
        for (let topicEvent of topicEvents) {
            delete topicEvent._id;
            equipment.add(topicEvent.equipment);
            if (topicEvent.level == 'Events') {
                events.push(topicEvent);
            } else if (topicEvent.level == 'Organization') {
                organizations.push(topicEvent);
            } else {
                procurements.push(topicEvent);
            }
        }

        res.equipment = Array.from(equipment);
        res.events = events;
        res.organization = organizations;
        res.procurement = procurements;
        res.times = times;
    }
    else {
        res = 'data is none'
    }


    ctx.response.status = 200;
    ctx.response.body = res;
};

//智库查询
exports.getKnowledgedbs = async (ctx) => {
    //获取pid
    let pid = ctx.request.body.pid;
    let type = ctx.request.body.type;

    let query = {};

    //查询所有数据
    let knowledgedbs = await mongodb.getKnowledgedbs(db_name, coll_knowledgedb, query);

    let res = {};

    if (type == '0') {//查询菜单树
        let entities = [];
        for (let data of knowledgedbs) {
            if (data.pid == pid) {
                let id = data.id;
                let entitie = {};
                entitie.id = id;
                entitie.text = data.name;
                entitie.isShow = false;
                entitie.isChecked = false;

                let child_list = [];
                for (let child of knowledgedbs) {
                    if (child.pid == id) {
                        let obj = {};
                        obj.id = child.id;
                        obj.text = child.name;
                        obj.isChosed = false;
                        child_list.push(obj);
                    }
                }
                entitie.child_list = child_list;
                entities.push(entitie);
            }
        }
        res.entities = entities;
    } else if (type == '1') {//从一级生产商查询
        let oneProducer = [];
        let twoProducer = [];
        let threeProducer = [];

        //获取一级承包商
        for (let data of knowledgedbs) {
            if (data.pid.includes(pid)) {
                oneProducer.push(data);
            }
        }

        //获取二级承包商
        if (oneProducer.length > 0) {
            for (let data of knowledgedbs) {
                if (data.pid.includes(oneProducer[0].id)) {
                    twoProducer.push(data);
                }
            }
        }

        //获取三级承包商
        if (twoProducer.length > 0) {
            for (let data of knowledgedbs) {
                if (data.pid.includes(twoProducer[0].id)) {
                    threeProducer.push(data);
                }
            }
        }

        res.oneProducer = oneProducer;
        res.twoProducer = twoProducer;
        res.threeProducer = threeProducer;

    } else if (type == '2') {//从二级生产商查询
        let twoProducer = [];
        let threeProducer = [];

        //获取二级承包商
        for (let data of knowledgedbs) {
            if (data.pid.includes(pid)) {
                twoProducer.push(data);
            }
        }

        //获取三级承包商
        if (twoProducer.length > 0) {
            for (let data of knowledgedbs) {
                if (data.pid.includes(twoProducer[0].id)) {
                    threeProducer.push(data);
                }
            }
        }

        res.twoProducer = twoProducer;
        res.threeProducer = threeProducer;
    } else if (type == '3') {//从三级生产商查询
        let threeProducer = [];

        //获取三级承包商
        for (let data of knowledgedbs) {
            if (data.pid.includes(pid)) {
                threeProducer.push(data);
            }
        }

        res.threeProducer = threeProducer;
    }

    ctx.response.status = 200;
    ctx.response.body = res;
};
