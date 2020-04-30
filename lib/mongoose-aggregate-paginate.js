/**
 * Mongoose Aggregate Paginate
 * @param  {Aggregate} aggregate
 * @param  {any} options
 * @param  {function} [callback]
 * @returns {Promise}
 */

const defaultOptions = {
  customLabels: {
    totalDocs: 'totalDocs',
    limit: 'limit',
    page: 'page',
    totalPages: 'totalPages',
    docs: 'docs',
    nextPage: 'nextPage',
    prevPage: 'prevPage',
    pagingCounter: 'pagingCounter',
    meta: null
  },
  collation: {},
  lean: false,
  leanWithId: true,
  limit: 10,
  projection: {},
  select: '',
  options: {},
  pagination: true
};

function aggregatePaginate(query, options, callback) {
  options = {
    ...defaultOptions,
    ...aggregatePaginate.options,
    ...options
  };

  query = query || {};

  const {
    collation,
    lean,
    leanWithId,
    populate,
    projection,
    select,
    sort,
  } = options;

  const customLabels = {
    ...defaultOptions.customLabels,
    ...options.customLabels
  };

  const limit = parseInt(options.limit, 10) || 0;
  const allowDiskUse = options.allowDiskUse || false;
  const isPaginationEnabled = options.pagination === false ? false : true;

  const isCallbackSpecified = typeof callback === 'function';
  const findOptions = options.options;

  let offset;
  let page;
  let skip;

  let docsPromise = [];
  let docs = [];

  // Custom Labels
  const labelDocs = customLabels.docs;
  const labelLimit = customLabels.limit;
  const labelNextPage = customLabels.nextPage;
  const labelPage = customLabels.page;
  const labelPagingCounter = customLabels.pagingCounter;
  const labelPrevPage = customLabels.prevPage;
  const labelTotal = customLabels.totalDocs;
  const labelTotalPages = customLabels.totalPages;
  const labelMeta = customLabels.meta;

  if (options.hasOwnProperty('offset')) {
    offset = parseInt(options.offset, 10);
    skip = offset;
  } else if (options.hasOwnProperty('page')) {
    page = parseInt(options.page, 10);
    skip = (page - 1) * limit;
  } else {
    offset = 0;
    page = 1;
    skip = offset;
  }

  const q = this.aggregate(query._pipeline);
  const countQuery = this.aggregate(q._pipeline);

  if (q.hasOwnProperty('options')) {
    q.options = query.options;
    countQuery.options = query.options;
  }

  if (sort) {
    q.sort(sort);
  }

  if (allowDiskUse) {
    q.allowDiskUse(true)
    countQuery.allowDiskUse(true)
  }

  if (isPaginationEnabled) {
    q.skip(skip).limit(limit);
  }

  return Promise.all([
    countQuery.group({
      _id: null,
      count: {
        $sum: 1
      }
    }).exec(),
    q.exec()
  ])
    .then(function (values) {

      const [data, docs] = values;

      const count = data[0] ? data[0].count : 0;

      const meta = {
        [labelTotal]: count,
        [labelLimit]: limit
      };

      let result = {};

      if (typeof offset !== 'undefined') {

        page = Math.ceil((offset + 1) / limit);

        meta.offset = offset;
        meta[labelPage] = Math.ceil((offset + 1) / limit);
        meta[labelPagingCounter] = offset + 1;
      }

      if (typeof page !== 'undefined') {
        const pages = (limit > 0) ? (Math.ceil(count / limit) || 1) : null;

        meta.hasPrevPage = false;
        meta.hasNextPage = false;

        meta[labelPage] = page;
        meta[labelTotalPages] = pages;
        meta[labelPagingCounter] = ((page - 1) * limit) + 1;

        // Set prev page
        if (page > 1) {
          meta.hasPrevPage = true;
          meta[labelPrevPage] = (page - 1);
        } else {
          meta[labelPrevPage] = null;
        }

        // Set next page
        if (page < pages) {
          meta.hasNextPage = true;
          meta[labelNextPage] = (page + 1);
        } else {
          meta[labelNextPage] = null;
        }
      }

      if (labelMeta) {
        result = {
          [labelDocs]: docs,
          [labelMeta]: meta
        };
      } else {
        result = {
          [labelDocs]: docs,
          ...meta
        };
      }

      return isCallbackSpecified ? callback(null, result) : Promise.resolve(result);

    })
    .catch(function (error) {
      return isCallbackSpecified ? callback(error) : Promise.reject(error);
    })
}

/**
 * @param {Schema} schema
 */
module.exports = (schema) => {
  schema.statics.aggregatePaginate = aggregatePaginate;
};

module.exports = aggregatePaginate;