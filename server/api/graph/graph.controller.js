const neo4j = require('./../../orm/neo4j');

exports.nodes = async (ctx) => {
    ctx.response.status = 200;
    ctx.response.body = await neo4j.allNodes();
};

exports.paths = async (ctx) => {
    const start = ctx.params.start;
    const end = ctx.params.end;
    ctx.response.status = 200;
    ctx.response.body = await neo4j.allPaths(start, end);
};

exports.fuzzy = async (ctx) => {
    const words = ctx.params.words;
    ctx.response.status = 200;
    ctx.response.body = await neo4j.fuzzyQuery(words);
};