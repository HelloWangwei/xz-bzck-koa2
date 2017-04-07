const elasticsearch = require('elasticsearch');
const orm = require('./../config/orm.conf');

const client = new elasticsearch.Client({
    hosts: orm.elastic_hosts
});

module.exports = {
    search: async (query, sort, size, from) => {
        if (from == null) {
            from = 0;
        }
        if (sort == null) {
            sort = "current_time:desc"
        }
        if (size == null) {
            size = 20;
        }
        let hits;
        let total;
        let aggs;
        try {
            let resp = await client.search({
                index: orm.es_index,
                type: orm.es_type,
                body: query,
                size: size,
                sort: sort,
                from: from
            });
            total = resp.hits.total;
            hits = resp.hits.hits;
            aggs = resp.aggregations;
        } catch (err) {
            console.log(err);
        }
        return {hits: hits, total: total,aggs:aggs};
    }
};