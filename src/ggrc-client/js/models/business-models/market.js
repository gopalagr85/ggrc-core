/*
    Copyright (C) 2019 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

import Cacheable from '../cacheable';
import uniqueTitle from '../mixins/unique-title';
import caUpdate from '../mixins/ca-update';
import accessControlList from '../mixins/access-control-list';
import scopeObjectNotifications from '../mixins/notifications/scope-object-notifications';
import questionnaire from '../mixins/questionnaire';
import Stub from '../stub';

export default Cacheable.extend({
  root_object: 'market',
  root_collection: 'markets',
  category: 'scope',
  findAll: 'GET /api/markets',
  findOne: 'GET /api/markets/{id}',
  create: 'POST /api/markets',
  update: 'PUT /api/markets/{id}',
  destroy: 'DELETE /api/markets/{id}',
  mixins: [
    uniqueTitle,
    caUpdate,
    accessControlList,
    scopeObjectNotifications,
    questionnaire,
  ],
  is_custom_attributable: true,
  isRoleable: true,
  attributes: {
    context: Stub,
    modified_by: Stub,
  },
  tree_view_options: {
    attr_list: Cacheable.attr_list.concat([
      {attr_title: 'Reference URL', attr_name: 'reference_url'},
      {attr_title: 'Effective Date', attr_name: 'start_date'},
      {attr_title: 'Last Deprecated Date', attr_name: 'end_date'},
      {
        attr_title: 'Launch Status',
        attr_name: 'status',
        order: 40,
      }, {
        attr_title: 'Description',
        attr_name: 'description',
      }, {
        attr_title: 'Notes',
        attr_name: 'notes',
      }, {
        attr_title: 'Assessment Procedure',
        attr_name: 'test_plan',
      },
    ]),
  },
  sub_tree_view_options: {
    default_filter: ['Program'],
  },
  defaults: {
    status: 'Draft',
  },
  statuses: ['Draft', 'Deprecated', 'Active'],
}, {
  define: {
    title: {
      value: '',
      validate: {
        required: true,
        validateUniqueTitle: true,
      },
    },
    _transient_title: {
      value: '',
      validate: {
        validateUniqueTitle: true,
      },
    },
  },
});
