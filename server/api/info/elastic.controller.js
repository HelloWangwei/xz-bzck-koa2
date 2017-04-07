const elastic = require('./../../orm/elasticsearch');
const moment = require('moment');
const neo4j = require('./../../orm/neo4j');

exports.getInfoList = async (ctx) => {
    let body = ctx.request.body;

    let query;

    let websites = [];
    let cores = [];
    let importants = [];
    let normals = [];

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
                        must: [{match: {website_url: body.website}}],
                        filter: {range: {current_time: {gte: body.start, lte: body.end}}}
                    }
                }
            };
        } else {
            query = {
                query: {
                    bool: {
                        must: [{match: {website_url: body.website}}, {
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
                        must: [
                            {
                                bool: {
                                    should: []
                                }
                            }
                        ],
                        filter: {range: {current_time: {gte: body.start, lte: body.end}}}
                    }
                }
            };
            for (let website of body.websites) {
                query.query.bool.must[0].bool.should.push(
                    {match: {website_url: website}}
                );
            }
        } else {
            query = {
                query: {
                    bool: {
                        must: [
                            {
                                bool:{
                                    should:[]
                                }
                            },
                            {
                                multi_match: {
                                    query: body.keyword,
                                    fields: ["title", "content"]
                                }
                            }],
                        filter: {range: {current_time: {gte: body.start, lte: body.end}}}
                    }
                }
            };
            for(let website of body.websites){
                query.query.bool.must[0].bool.should.push(
                    {match: {website_url: website}}
                );
            }
        }
    }

    let sort = "current_time:" + body.timeSort;

    let resJson = await elastic.search(query, sort, null, body.page * 20 - 20);

    let res = [];
    for (let hit of resJson.hits) {
        let info = hit._source;
        delete info.content;
        delete info.related;
        res.push(info);
    }

    ctx.response.status = 200;
    ctx.response.body = {res: res, total: resJson.total};

};

exports.keywordSearch = async (ctx) => {
    let type = ctx.request.body.type;
    let keyword = ctx.request.body.keyword;
    let page = ctx.request.body.page;

    let query = {
        query: {
            term: {
                [type]: keyword
            }
        }
    };
    let resJson = await elastic.search(query, null, null, page * 20 - 20);

    let res = [];
    for (let hit of resJson.hits) {
        let info = hit._source;
        delete info.content;
        delete info.related;
        res.push(info);
    }

    ctx.response.status = 200;
    ctx.response.body = {res: res, total: resJson.total};
};


exports.infoDetail = async (ctx) => {
    let id = ctx.request.body.id;

    let query = {
        query: {
            match: {
                id: id
            }
        }
    };
    let resJson = await elastic.search(query, null, null, null);

    let res = resJson.hits[0]._source;
    let person = res.person;
    let country = res.country;
    let organization = res.organization;
    let tech = res.tech;
    let location = res.location;
    let program = res.program;
    let related = res.related;

    //相关文章为空时
    if (!related.length > 0) {
        //noinspection JSDuplicatedDeclaration
        let query = {
            query: {
                bool: {
                    must: {
                        bool: {
                            should: {terms: {person: person}},
                            should: {terms: {country: country}},
                            should: {terms: {organization: organization}},
                            should: {terms: {tech: tech}},
                            should: {terms: {location: location}},
                            should: {terms: {program: program}}
                        }
                    }
                }
            }
        };
        let resJson = await elastic.search(query, null, 5, null);

        for (let info of resJson.hits) {
            info = info._source;
            delete info.content;
            delete info.abstractcontent;

            related.push(info)
        }
    }

    delete res.person;
    delete res.country;
    delete res.organization;
    delete res.tech;
    delete res.location;
    delete res.program;

    ctx.response.status = 200;
    ctx.response.body = {
        info: res,
        person: person,
        organization: organization,
        country: country,
        tech: tech,
        program: program,
        location: location,
        related: related
    };
};

exports.relatedSearch = async (ctx) => {
    let types = ctx.request.body.types.split(',');
    let keyword = ctx.request.body.keyword;
    let scriptQuery = "";
    //六大类
    types.forEach(function (type) {
        scriptQuery += "doc['" + type + "'].size()>0||"
    });
    let query = {
        query: {
            bool: {
                must: [
                    {
                        script: {
                            script: {
                                inline: scriptQuery.substring(0, scriptQuery.length - 2),
                            }
                        }
                    },
                    {
                        bool:{
                            should:[{
                                match_phrase:{
                                    title:keyword
                                },
                                match_phrase:{
                                    content:keyword
                                },
                            }
                            ]
                        }
                    }
                ]
            }
        }

    };

    let aggs = {};
    for (let type of types) {
        aggs[type] = {terms: {field: type, size: 10}};
    }

    query.aggs = aggs;
    let res = await elastic.search(query, null, null, null);

    let infos = [];
    for (let info of res.hits) {
        info = info._source;
        delete info['related'];
        delete info['content'];
        infos.push(info);
    }
    //实体集合
    let entities = [];
    let chosedList = [];
    let aggResult = res.aggs;

    for (let type of types) {
        let buckets = aggResult[type].buckets;
        let name = '';
        if (type == 'program') {
            name = '项目'
        } else if (type == 'person') {
            name = '人员'
        } else if (type == 'organization') {
            name = '机构'
        } else if (type == 'tech') {
            name = '技术'
        } else if (type == 'location') {
            name = '地区'
        } else if (type == 'country') {
            name = '国家'
        }
        let entity = {
            text: type,
            name: name,
            list: buckets,
            isShow: false,
            index: '0',
            more: buckets.length == 10
        };
        entities.push(entity);
        let chosed = {
            text: type,
            list: []
        };
        chosedList.push(chosed);
    }

    ctx.response.status = 200;
    ctx.response.body = {infos: infos, total: res.total, entities: entities, chosedList: chosedList};
};

exports.moreInstance = async (ctx) => {
    let type = ctx.request.body.type;
    let keyword = ctx.request.body.keyword;
    let index = ctx.request.body.index;

    let query = {
        query: {
            bool: {
                filter: {
                    multi_match: {
                        query: keyword,
                        fields: ["title", "content"]
                    }
                }
            }
        }
    };

    let aggs = {};
    aggs[type] = {terms: {field: type, size: 1000}};
    query.aggs = aggs;
    let res = await elastic.search(query, null, null, null);

    //更多实体
    let moreEntities = [];
    let aggResult = res.aggs;
    let buckets = aggResult[type].buckets;
    let end = (index + 1) * 10 < buckets.length ? (index + 1) * 10 : buckets.length;
    let flag = (index + 1) * 10 < buckets.length;

    for (let i = index * 10; i < end; i++) {
        moreEntities.push(buckets[i]);
    }

    ctx.response.status = 200;
    ctx.response.body = {moreEntities: moreEntities, flag: flag};
};

exports.getSearchInfos = async (ctx) => {
    let types = ctx.request.body.types.split(',');
    let keyword = ctx.request.body.keyword;
    let page = ctx.request.body.page;
    let scriptQuery = "";
    //六大类
    types.forEach(function (type) {
        scriptQuery += "doc['" + type + "'].size()>0||"
    });
    let query = {
        query: {
            bool: {
                must: [
                    {
                        script: {
                            script: {
                                inline: scriptQuery.substring(0, scriptQuery.length - 2),
                            }
                        }
                    },
                    {
                        bool:{
                            should:[{
                                match_phrase:{
                                    title:keyword
                                },
                                match_phrase:{
                                    content:keyword
                                },
                            }
                            ]
                        }
                    }
                ]
            }
        }

    };

    let res = await elastic.search(query, null, null, page * 20 - 20);
    let infos = [];
    for (let info of res.hits) {
        info = info._source;
        delete info['related'];
        delete info['content'];
        infos.push(info);
    }
    ctx.response.status = 200;
    ctx.response.body = {infos: infos, total: res.total};
};

exports.getEntityInfos = async (ctx) => {
    let types = ctx.request.body.types;
    let keyword = ctx.request.body.keyword;
    let page = ctx.request.body.page;
    let query = {
        query: {
            bool: {
                must: [
                    {
                        bool: {
                            should: []
                        }
                    },
                    {
                        bool:{
                            should:[{
                                match_phrase:{
                                    title:keyword
                                },
                                match_phrase:{
                                    content:keyword
                                },
                            }
                            ]
                        }
                    }

                ],

                }
            }
        }
    for (let type of types) {
        let typeQuery = {terms: {}};
        typeQuery.terms[type.text] = type.list;
        query.query.bool.must[0].bool.should.push(typeQuery);
    }
    let res = await elastic.search(query, null, null, page * 20 - 20);
    let infos = [];
    for (let info of res.hits) {
        info = info._source;
        delete info['related'];
        delete info['content'];
        infos.push(info);
    }
    ctx.response.status = 200;
    ctx.response.body = {infos: infos, total: res.total};
};

exports.checkInstanceInfos = async (ctx) => {
    let types = ctx.request.body.types;
    let keyword = ctx.request.body.keyword;
    let query = {
        query: {
            bool: {
                filter: {
                    multi_match: {
                        query: keyword,
                        fields: ["title", "content"]
                    }
                },
                must: {
                    bool: {
                        should: []
                    }
                }
            }
        }
    };
    for (let type of types) {
        let typeQuery = {terms: {}};
        typeQuery.terms[type.text] = type.list;
        query.query.bool.must.bool.should.push(typeQuery);
    }
    let res = await elastic.search(query, null, null, null);
    let infos = [];
    for (let info of res.hits) {
        info = info._source;
        delete info['related'];
        delete info['content'];
        infos.push(info);
    }
    ctx.response.status = 200;
    ctx.response.body = {infos: infos, total: res.total};
};

exports.globalSearchHint = async (ctx) => {
    let keyword = ctx.request.body.keyword;

    let query = {
        query: {
            prefix: {tech: {"value": keyword, "boost": 2.0}}
        }
    };

    let resJson = await elastic.search(query, null, 10, null);
    let res = new Set();
    for (let hit of resJson.hits) {
        let techs = hit._source.tech;
        for (let tech of techs) {
            if (tech.startsWith(keyword)) {
                res.add(tech);
            }
        }
    }

    ctx.response.status = 200;
    ctx.response.body = {res: Array.from(res)};
};

exports.globalSearch = async (ctx) => {
    let body = ctx.request.body;
    if (body.end == '') {
        body.end = moment().format('YYYY-MM-DD');
    }
    if (body.start == '') {
        body.start = '1990-01-01';
    }

    let query = {
        query: {
            bool: {
                must: [
                    {
                    multi_match: {
                        query: body.keyWord,
                        fields: ["content", "title"],
                        boost:1.0
                    }
                }],
               filter: {range: {current_time: {gte: body.start, lte: body.end}}}
            },
        },
        highlight: {
            require_field_match: true,
            fields: {
                title: {
                    pre_tags: ["<b style=\"color: red; \">"],
                    post_tags: ["</b>"]
                }
            }
        }
    };
    let sort;
    if(body.timeSort=='desc') {
        sort = "current_time:" + body.timeSort;
    }else {
        sort = '';
    }

    let resJson = await elastic.search(query, sort, null, body.page * 20 - 20);

    let res = [];
    for (let hit of resJson.hits) {
        let info = hit._source;
        delete info.content;
        delete info.related;

        if (hit.highlight != undefined) {
            info.title = hit.highlight.title[0];
        }
        res.push(info);
    }
    ctx.response.status = 200;

    ctx.response.body = {res: res, total: resJson.total};
};

exports.initForce = async (ctx) => {
    let entities = ctx.request.body;
    let nodes = [];
    for (let en of entities) {
        let type = en.text;
        let group = '';
        if (type == 'program') {
            group = '1'
        } else if (type == 'person') {
            group = '2'
        } else if (type == 'organization') {
            group = '3'
        } else if (type == 'tech') {
            group = '4'
        } else if (type == 'location') {
            group = '5'
        } else if (type == 'country') {
            group = '6'
        }
        for (let buck of en.list) {
            let node = {
                id: buck.key,
                group: group,
                type: type
            };
            nodes.push(node);
        }
    }
    let doubleNodes = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            let obj = {
                fromId: nodes[i].id,
                fromGroup: nodes[i].group,
                fromType: nodes[i].type,
                toId: nodes[j].id,
                toGroup: nodes[j].group,
                toType: nodes[j].type
            };
            doubleNodes.push(obj);
        }
    }
    let links = [];
    for (let node of doubleNodes) {
        let from = {
            source: node.fromId,
            target: node.toId,
            value: 1
        };
        let to = {
            source: node.toId,
            target: node.fromId,
            value: 1
        };
        links.push(from);
        links.push(to);
    }
    ctx.response.status = 200;
    ctx.response.body = {nodes: nodes, links: links};
};

exports.updateForce = async (ctx) => {
    let nodes = ctx.request.body.nodes;
    let links = ctx.request.body.links;
    let searchNode = [];
    for (let link of links) {
        let type = link.text;
        for (let buck of link.list) {
            let node = {
                name: buck,
                type: type
            };
            searchNode.push(node);
        }
    }
    let resLinks = [];
    for (let search of searchNode) {
        let relateds = await neo4j.getRelateds(search);
        for (let res of relateds) {
            let links = [];
            let link = {
                source: search.name,
                target: res['_fields'][0]['end']['properties']['name'],
                value: res['_fields'][0]['segments'][0]['relationship']['properties']['count']['low']
            };
            for (let node of nodes) {
                if (node.id == link.target) {
                    resLinks.push(link);
                    break;
                }
            }
        }
    }
    ctx.response.status = 200;
    ctx.response.body = {links: resLinks};
};