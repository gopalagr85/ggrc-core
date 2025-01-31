/*
    Copyright (C) 2019 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

import {splitTrim} from '../../../plugins/ggrc_utils';
import loIndexOf from 'lodash/indexOf';
import loSome from 'lodash/some';
import loFind from 'lodash/find';
import canStache from 'can-stache';
import canMap from 'can-map';
import canComponent from 'can-component';
import template from './add-template-field.stache';

// the field types that require a list of possible values to be defined
const multiChoiceable = ['Dropdown', 'Multiselect'];

export default canComponent.extend({
  tag: 'add-template-field',
  view: canStache(template),
  leakScope: true,
  viewModel: canMap.extend({
    define: {
      isDisplayValues: {
        get() {
          let type = this.attr('selected.type');
          return multiChoiceable.includes(type);
        },
      },
    },
    selected: [],
    fields: [],
    types: [],
    /*
     * Create a new field.
     *
     * Field must contain value title, type, values.
     * Opts are populated, once we start changing checkbox values
     *
     * @param {canMap} viewModel - the current (add-template-field) viewModel
     * @param {jQuery.Object} el - the clicked DOM element
     * @param {Object} ev - the event object
     */
    addField() {
      let fields = this.attr('fields');
      let selected = this.attr('selected');
      let title = selected.title && selected.title.trim();
      let type = selected.type && selected.type.trim();
      let values = splitTrim(selected.values, {
        unique: true,
      }).join(',');
      this.attr('selected.invalidValues', false);
      this.attr('selected.invalidTitleError', '');

      let validators = this.getValidators(title, fields);
      this.validateTitle(validators);
      this.validateValues(values);

      if (
        this.attr('selected.invalidValues') ||
        this.attr('selected.invalidTitleError')
      ) {
        return;
      }

      fields.push({
        id: this.attr('id'),
        title: title,
        attribute_type: type,
        multi_choice_options: values,
      });
      ['title', 'values', 'multi_choice_options'].forEach(
        (type) => {
          selected.attr(type, '');
        }
      );
    },
    validateValues(values) {
      let invalidValues = this.attr('isDisplayValues') && !values;
      this.attr('selected.invalidValues', invalidValues);
    },
    validateTitle(validators) {
      const errorMessage = validators.reduce((prev, next) => {
        if (prev) {
          return prev;
        }

        return next();
      }, '');

      this.attr('selected.invalidTitleError', errorMessage);
    },
    getValidators(title, fields) {
      return [
        isEmptyTitle.bind(null, title),
        isInvalidTitle.bind(null, title),
        isDublicateTitle.bind(null, fields, title),
        isReservedByCustomAttr.bind(null, title),
        isReservedByModelAttr.bind(null, title),
      ];
    },
  }),
  events: {
    /*
     * Set default dropdown type on init
     */
    init() {
      let types = this.viewModel.attr('types');
      if (!this.viewModel.attr('selected.type')) {
        this.viewModel.attr('selected.type', types[0].attr('type'));
      }
    },
  },
  helpers: {
    /*
     * Get input placeholder value depended on type
     *
     * @param {Object} options - Template options
     */
    placeholder(options) {
      let types = this.attr('types');
      let item = loFind(types, {
        type: this.attr('selected.type'),
      });
      if (item) {
        return item.text;
      }
    },
  },
});

const isEqualTitle = (title, attr) => {
  return attr && attr.toLowerCase() === title.toLowerCase();
};

const isDublicateTitle = (fields, selectedTitle) => {
  let duplicateField = loSome(fields, (item) => {
    return item.title.toLowerCase() === selectedTitle.toLowerCase() &&
      !item._pending_delete;
  });
  return fields.length && duplicateField ?
    'A custom attribute with this title already exists' :
    '';
};

const isEmptyTitle = (selectedTitle) => {
  return !selectedTitle ?
    'A custom attribute title cannot be blank' :
    '';
};

const isInvalidTitle = (title) => {
  if (loIndexOf(title, '*') !== -1) {
    return 'A custom attribute title cannot contain *';
  }
  return '';
};

const isReservedByCustomAttr = (title) => {
  const customAttrs = GGRC.custom_attr_defs
    .filter((attr) =>
      attr.definition_type && attr.definition_type === 'assessment'
    ).filter((attr) =>
      isEqualTitle(title, attr.title)
    );

  return customAttrs.length ?
    'Custom attribute with such name already exists' :
    '';
};

const isReservedByModelAttr = (title) => {
  const modelAttrs = GGRC.model_attr_defs.Assessment.filter(
    (attr) => isEqualTitle(title, attr.display_name)
  );

  return modelAttrs.length ?
    'Attribute with such name already exists' :
    '';
};

export {
  isDublicateTitle,
  isEmptyTitle,
  isInvalidTitle,
  isReservedByCustomAttr,
  isReservedByModelAttr,
};
