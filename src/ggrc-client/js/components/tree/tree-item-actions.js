/*
 Copyright (C) 2019 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

import canStache from 'can-stache';
import canMap from 'can-map';
import canComponent from 'can-component';
import '../lazy-render/lazy-render';
import '../show-related-assessments-button/show-related-assessments-button';
import template from './templates/tree-item-actions.stache';
import {
  isSnapshot,
} from '../../plugins/utils/snapshot-utils';
import {
  getPageType,
} from '../../plugins/utils/current-page-utils';
import Permission from '../../permission';
import {getMappingList} from '../../models/mappers/mappings';

const forbiddenEditList = ['Cycle', 'CycleTaskGroup'];

const viewModel = canMap.extend({
  define: {
    deepLimit: {
      type: 'number',
      value: 0,
    },
    canExpand: {
      type: 'boolean',
      value: false,
    },
    expandIcon: {
      type: 'string',
      get() {
        return this.attr('expanded') ? 'compress' : 'expand';
      },
    },
    expanderTitle: {
      type: 'string',
      get() {
        return this.attr('expanded') ? 'Collapse tree' : 'Expand tree';
      },
    },
    isSnapshot: {
      type: 'boolean',
      get() {
        return isSnapshot(this.attr('instance'));
      },
    },
    denyEditAndMap: {
      type: 'boolean',
      get() {
        let instance = this.attr('instance');
        let type = instance.attr('type');
        let isSnapshot = this.attr('isSnapshot');
        let isArchived = instance.attr('archived');
        let isInForbiddenList = forbiddenEditList.indexOf(type) > -1;
        return !Permission.is_allowed_for('update', instance) ||
          (isSnapshot || isInForbiddenList || isArchived);
      },
    },
    isAllowedToEdit: {
      type: 'boolean',
      get() {
        return !this.attr('denyEditAndMap')
          && !this.attr('instance').constructor.isChangeableExternally
          && !this.attr('instance.readonly');
      },
    },
    isAllowedToMap: {
      type: 'boolean',
      get() {
        let type = this.attr('instance.type');

        if (type === 'Assessment') {
          let audit = this.attr('instance.audit');

          if (!Permission.is_allowed_for('read', audit)) {
            return false;
          }
        }

        let denyEditAndMap = this.attr('denyEditAndMap');
        let mappingTypes = getMappingList(type);

        return !denyEditAndMap && !!mappingTypes.length;
      },
    },
  },
  maximizeObject(scope, el, ev) {
    ev.preventDefault();
    ev.stopPropagation();

    this.dispatch({
      type: 'preview',
      element: el,
    });
  },
  $el: null,
  openObject(scope, el, ev) {
    ev.stopPropagation();
  },
  expand(scope, el, ev) {
    this.dispatch('expand');
    ev.stopPropagation();
  },
  instance: null,
  childOptions: null,
  addItem: null,
  isAllowToExpand: null,
  childModelsList: null,
  expanded: false,
  activated: false,
  showReducedIcon() {
    let pages = ['Workflow'];
    let instanceTypes = [
      'Cycle',
      'CycleTaskGroup',
      'CycleTaskGroupObjectTask',
    ];
    return pages.includes(getPageType()) &&
      instanceTypes.includes(this.attr('instance').type);
  },
  showReducedOptions() {
    let pages = ['Workflow'];
    let instanceTypes = [
      'Cycle',
      'CycleTaskGroup',
    ];
    return pages.includes(getPageType()) &&
      instanceTypes.includes(this.attr('instance').type);
  },
});

export default canComponent.extend({
  tag: 'tree-item-actions',
  view: canStache(template),
  leakScope: true,
  viewModel,
  events: {
    inserted() {
      let parents = this.element.parents('sub-tree-wrapper').length;
      let canExpand = parents < this.viewModel.attr('deepLimit');
      this.viewModel.attr('canExpand', canExpand);
      this.viewModel.attr('$el', this.element);
    },
    '.tree-item-actions__content mouseenter'(el, ev) {
      let vm = this.viewModel;

      if (!vm.attr('activated')) {
        vm.attr('activated', true);
      }
      // event not needed after render of content
      el.off(ev);
    },
  },
});
