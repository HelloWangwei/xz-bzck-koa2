const mongodb = require('./../../orm/mongodb');
const elastic = require('./../../orm/elasticsearch');

const db_name = 'xz_sys';
const coll_collection = 'user_collection';
const coll_userNote = 'UserNote';
const db_name2 = 'xz';
const coll_log = 'log';

const moment = require('moment');


exports.getRecommend = async (ctx) => {
    let recommend = await mongodb.getRecommend();
    if(recommend){
        let imgQuery = {query: {"terms": {"id": recommend.imgInfo}}};
        let normalQuery = {query: {"terms": {"id": recommend.normalInfo}}};
        let textQuery = {query: {"terms": {"id": recommend.textInfo}}};

        let imgInfos = (await elastic.search(imgQuery, null, null, null)).hits;
        let normalInfos = (await elastic.search(normalQuery, null, null, null)).hits;
        let textInfos = (await elastic.search(textQuery, null, null, null)).hits;

        let imgs = [];
        for (let imgInfo of imgInfos) {
            delete imgInfo._source.content;
            delete imgInfo._source.related;
            imgs.push(imgInfo._source);
        }

        let normals = [];
        for (let normalInfo of normalInfos) {
            delete normalInfo._source.content;
            delete normalInfo._source.related;
            normals.push(normalInfo._source);
        }

        let texts = [];
        for (let textInfo of textInfos) {
            delete textInfo._source.content;
            delete textInfo._source.related;
            texts.push(textInfo._source);
        }
        ctx.response.status = 200;
        ctx.response.body = {
            imgInfos: imgs,
            normalInfos: normals,
            textInfos: texts,
            today: moment().format('YYYY-MM-DD')
        };
    }

};

exports.WebsiteFocusInit = async (ctx) => {
    let userid = ctx.request.body.userid;

    let res = [];

    let body;

    let websites = await mongodb.getWebSitesInfo(userid);
    if (websites != false) {
        let urls = [];
        let cores = [];
        let importants = [];
        let normals = [];
        if (websites != false) {
            for (let web of websites) {
                urls.push(web.url);
                if (web.level == 'core') {
                    cores.push(web);
                } else if (web.level == 'important') {
                    importants.push(web);
                } else {
                    normals.push(web);
                }
            }
        }

        let query = {
            query: {
                bool: {
                    must: {
                        bool: {
                            should: []
                        }
                    }
                }
            }
        };
        for (let url of urls) {
            query.query.bool.must.bool.should.push(
                {
                    match: {
                        website_url: url
                    }
                }
            );
        }
        let result = await elastic.search(query);
        for (let hit of result.hits) {
            let info = hit._source;
            delete info.content;
            delete info.related;
            res.push(info);
        }
        body = {
            res: res,
            totalPage: result.total,
            urls: urls,
            websites: {cores: cores, importants: importants, normals: normals}
        };
    } else {
        websites = await mongodb.find(db_name, 'websites', null, 0);
        for (let website of websites) {
            delete website._id;
        }
        res = websites;
        body = {res: res}
    }
    ctx.response.status = 200;
    ctx.response.body = body;
};

exports.initWebsites = async (ctx) => {
    let userid = ctx.request.body.userid;

    let websites = await mongodb.getWebSitesInfo(userid);
    let urls = [];
    let cores = [];
    let importants = [];
    let normals = [];
    for (let web of websites) {
        urls.push(web.url);
        if (web.level == 'core') {
            cores.push(web);
        } else if (web.level == 'important') {
            importants.push(web);
        } else {
            normals.push(web);
        }
    }
    ctx.response.status = 200;
    ctx.response.body = {
        urls: urls,
        websites: {cores: cores, importants: importants, normals: normals}
    };

};

exports.HomePageInit = async (ctx) => {
    let userid = ctx.request.body.userid;
    let websites = await mongodb.getWebSitesInfo(userid);
    let urls = [];

    //关注的网站
    if (websites != false) {
        for (let website of websites) {
            urls.push({name: website.name, url: website.url});
        }
    } else {
        urls = false;
    }

    //关注的专题
    let user = await mongodb.getUserTopics({id: userid});
    let topicIDs = user[0].userTopicId;
    let topics = [];
    for (let id of topicIDs) {
        let topic = await mongodb.getTopicsInfo({id: id});
        if (topic != false) {
            topics.push(topic[0]);
        }
    }

    let moreTopics = [];
    let prefixTopics = [];
    let topicsLessThree = [];

    if (topics != false) {
        if (topics.length > 3) {
            prefixTopics = topics.splice(0, 3);
            moreTopics = topics;
        } else {
            prefixTopics = topics;
        }
        for (let topic of prefixTopics) {

            //website_url 查询的拼凑
            let urls = [];
            let webiste_urls = [];
            let channls = [];

            for (let url of topic.website) {
                urls.push(url.url);
                if (url.flag == 0) {
                    webiste_urls.push(url.url);
                } else {
                    channls.push(url.url);
                }
            }
            let urlQuery = [];
            for(let website_url of webiste_urls){
                urlQuery.push({match:{website_url:website_url}});
            }
            for(let channl of channls){
                urlQuery.push({match:{channl:channl}});
            }
            //组织专题查询语句
            let query = {
                query: {
                    bool: {
                        must: [
                            {
                                bool: {
                                    should: [
                                        urlQuery
                                    ]
                                }
                            }
                        ]
                    }
                }
            };
            // if (topic.person.length + topic.organization.length + topic.tech.length +
            //     topic.location.length + topic.program.length + topic.country.length > 0) {
            //     query.query.bool.filter = {
            //         bool: {
            //             should: [
            //                 {terms: {person: topic.person}},
            //                 {terms: {organization: topic.organization}},
            //                 {terms: {tech: topic.tech}},
            //                 {terms: {location: topic.location}},
            //                 {terms: {program: topic.program}},
            //                 {terms: {country: topic.country}}
            //             ]
            //         }
            //     };
            // }
            //查询专题的具体信息
            let resJson = await elastic.search(query, null, 5, null);
            let infos = [];
            for (let hit of resJson.hits) {
                let info = hit._source;
                delete content;
                delete abstractcontent;
                infos.push(info);
            }

            //查询当天
            query.query.bool.must = [
                {
                    bool: {
                        should: [
                            urlQuery
                        ]
                    }
                },
                {
                    range: {
                        current_time: {
                            gte: moment().add(-1, 'days').format('YYYY-MM-DD'),
                            lte: moment().format('YYYY-MM-DD')
                        }
                    }
                }
            ];
            resJson = await elastic.search(query, null, null, null);
            let count = resJson.total;

            //查询一周内
            query.query.bool.must = [
                {
                    bool: {
                        should: [
                           urlQuery
                        ]
                    }
                },
                {
                    range: {
                        current_time: {
                            gte: moment().add(-7, 'days').format('YYYY-MM-DD'),
                            lte: moment().format('YYYY-MM-DD')
                        }
                    }
                }
            ];

            resJson = await elastic.search(query, null, null, null);
            let weekcount = resJson.total;


            //拼接查询结果
            let resBody = {topicname: topic.topic,topic:topic, count: count, weekcount: weekcount, articles: infos};

            topicsLessThree.push(resBody);
        }
    }
    //d3柱状图数据
    let d3Data = [];
    let templates = await mongodb.getAllTemplate();
    for (let topic of templates) {
        let websites = [];
        for (let web of topic.website) {
            websites.push({match:{website_url:web.url}});
        }
        let query = {
            query: {
                bool:{
                    must:{
                        bool:{
                            should:websites
                        }
                    }
                }
            }
        };
        let res = await elastic.search(query, null, null, null);
        let d3 = {name: topic.topic, size: res.total, topic: topic};
        d3Data.push(d3);
    }
    //map数据
    let mapQuery = {
        aggs: {
            country: {
                terms: {field: "country", size: 1000}
            }
        }
    };
    let res = await elastic.search(mapQuery, null, null, null);
    let mapData = res.aggs.country.buckets;

    ctx.response.status = 200;
    ctx.response.body = {
        sites: urls,
        moreTopics: moreTopics,
        topics: topicsLessThree,
        d3Data: d3Data,
        mapData: mapData
    };
};

exports.columnChange = async (ctx) => {
    let topic = ctx.request.body.topic;
    let urls = [];
    for (let url of topic.website) {
        urls.push(url.url);
    }
    let query = {
        query: {
            bool: {
                filter: {
                    terms: {website_url: urls}
                }
                // must: {
                //     bool: {
                //         should: [
                //             {terms: {person: topic.person}},
                //             {terms: {organization: topic.organization}},
                //             {terms: {tech: topic.tech}},
                //             {terms: {location: topic.location}},
                //             {terms: {program: topic.program}},
                //             {terms: {country: topic.country}}
                //         ]
                //     }
                // }
            }
        }
    };
    query.aggs = {
        country: {
            terms: {field: "country", size: 1000}
        }
    };
    let res = await elastic.search(query, null, null, null);
    let mapData = res.aggs.country.buckets;
    let USACOUNT = 0;
    for (let cou of mapData) {
        if ("U.S.A.,U.S.,US,Americans.,American,United States,US',US.,USA,United States of America,America,The US,Americans".indexOf(cou.key) > -1) {
            USACOUNT += cou.doc_count;
        }
    }
    mapData.push({key: "United States of America", doc_count: USACOUNT});
    ctx.response.status = 200;
    ctx.response.body = {mapData: mapData};
};

exports.addUserCollection = async (ctx) => {
    let body = ctx.request.body;
    let article = body.article;

    let userCollection = await mongodb.find(db_name, coll_collection, {userid: body.userID}, null);

    let saveDate = moment().format('YYYY-MM-DD');

    let infoCollections = [];

    let infoCollection = {
        id: article.id,
        url: article.url,
        imageName: article.imageName,
        title: article.title,
        saveDate: saveDate
    };
    if (userCollection) {
        await mongodb.updateUser(db_name, coll_collection, {userid: body.userID}, {$addToSet: {info_collection: infoCollection}});
    } else {
        infoCollections.push(infoCollection);
        let insert = {userid: body.userID, info_collection: infoCollections};
        await mongodb.insert(db_name, coll_collection, insert);
    }
    ctx.response.status = 200;
};

exports.cancelUserCollection = async (ctx) => {
    let userID = ctx.request.body.userID;
    let infoID = ctx.request.body.infoID;
    let userCollection = await mongodb.find(db_name, coll_collection, {userid: userID}, null);
    if (userCollection != undefined) {
        await mongodb.updateUser(db_name, coll_collection, {userid: userID}, {$pull: {info_collection: {id: infoID}}});
    }
    ctx.response.status = 200;
};

exports.exportSites = async (ctx) => {
    let body = ctx.request.body;

    let size = body.size;

    let websites = [];
    let cores = [];
    let importants = [];
    let normals = [];

    let res = {title: [], data: []};

    let query;

    for (let website of body.websites) {
        websites.push(website.url);

        if (website.level == 'core') {
            cores.push(website.url);
        } else if (website.level == 'important') {
            importants.push(website.url);
        } else {
            normals.push(website.url);
        }
    }

    if (body.end == '') {
        body.end = moment().format('YYYY-MM-DD');
    }
    if (body.start == '') {
        body.start = '1990-01-01';
    }

    if (body.website != '') {

        if (body.keyword == '') {
            query = {
                query: {
                    bool: {
                        must: [{term: {website_url: body.website}}],
                        filter: {range: {current_time: {gte: body.start, lte: body.end}}}
                    }
                }
            };
        } else {
            query = {
                query: {
                    bool: {
                        must: [{term: {website_url: body.website}}, {
                            multi_match: {
                                query: body.keyword,
                                fields: ["title", "content"]
                            }
                        }],
                        filter: {range: {current_time: {gte: body.start, lte: body.end}}}
                    }
                }
            };
        }

    } else {

        if (body.keyword == '') {
            query = {
                query: {
                    bool: {
                        must: {
                            bool: {
                                should: []
                            }
                        },
                        filter: {range: {current_time: {gte: body.start, lte: body.end}}}
                    }
                }
            };
            for (let website_url of body.websites) {
                query.query.bool.must.bool.should.push({match: {website_url: website_url}});
            }
        } else {
            query = {
                query: {
                    bool: {
                        must: [
                            {
                                bool: {
                                    should: []
                                }
                            },
                            {
                                multi_match: {
                                    query: body.keyword,
                                    fields: ["title", "content"]
                                }
                            }
                        ],
                        filter: {range: {current_time: {gte: body.start, lte: body.end}}}
                    }
                }
            };
            for (let website_url of body.websites) {
                query.query.bool.must[0].bool.should.push({match: {website_url: website_url}});
            }
        }
    }

    let sort = "current_time:" + body.timeSort;

    let result = await elastic.search(query, sort, size, 0);


    let title = [];
    for (let [index, hit] of new Map(result.hits.map((hit, index) => [index, hit]))) {
        let info = hit._source;
        /*标题只需要一组 循环第一次 添加标题*/
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
        /*循环标题 保证 value与title 顺序统一*/
        let data = [];
        for (let key of title) {
            let value = info[key.value];
            if (typeof value == "string") {
                value = value.replace(/<[^>]+>/g, "");
            }
            data.push({
                /*title为对象数组key.value为key值 从info中拿出该key放入data*/
                value: value,
                type: 'ROW_HEADER'
            });
        }
        res.data.push(data);
    }
    res.title = title;

    ctx.response.status = 200;
    ctx.response.body = {res: res, total: result.hits.length};

};
/*增加/修改导出数量监控log*/
exports.changeExportSum = async(ctx)=>{
    let uuid = require('node-uuid');
    let body = ctx.request.body;

    let userid = body.userid;
    let sum = body.sum;
    //过滤条件
    let logquery={
        operator:userid,
        engine:'export',
        startDate:moment().format('YYYY-MM-DD')
    };

    let data = await mongodb.find(db_name2,coll_log,logquery,null);

    if(data.length>0){//有就修改导出数量
        sum = sum+data[0].sum;
        let filter = {
            operator:userid,
            engine:'export',
            startDate:moment().format('YYYY-MM-DD')
        };
        let update = {$set: {sum: sum}};
        let re = await mongodb.update(db_name2,coll_log,filter,update);
    }else{//没有就新增
        let log = {
            id:uuid.v4(),
            operator:userid,
            engine:'export',
            sum:sum,
            startDate:moment().format('YYYY-MM-DD')
        };
        let re = await mongodb.insert(db_name2,coll_log,log);
    }

    ctx.response.status = 200;
};
//查询当前用户今日导出的总数量
exports.todayExportSum = async (ctx) => {
    let body = ctx.request.body;

    let userid = body.userid;

    let sum=0;

    //过滤条件
    let query={
        operator:userid,
        engine:'export',
        startDate:moment().format('YYYY-MM-DD')
    };

    //查询
    let data = await mongodb.find(db_name2,coll_log,query,null);
    if(data.length>0){
        sum = data[0].sum;
    }


    ctx.response.status = 200;
    ctx.response.body = {sum: sum};
};

exports.openNote = async(ctx) => {
    let noteID = ctx.request.body.noteID;

    let info = {};
    let note = {};

    if(noteID&&noteID.trim()!=''){
        note = await mongodb.find(db_name,coll_userNote,{id:noteID},null);
        delete note._id;
        if(note.length) {
            note = note[0];
            let query = {
                query:{
                    match: {id: note.articid}
                }
            };
            let result = await elastic.search(query, null, 1, 0);
            for(let hit of result.hits){
                info = hit._source;
                delete info.related;
            }
        }
    }

    ctx.response.status = 200;
    ctx.response.body = {info:info,note:note};
};