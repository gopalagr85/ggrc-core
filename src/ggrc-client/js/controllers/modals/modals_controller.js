/*
 Copyright (C) 2019 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

import {exists, filteredMap} from '../../plugins/ggrc_utils';
import loIsFunction from 'lodash/isFunction';
import loForEach from 'lodash/forEach';
import loFilter from 'lodash/filter';
import {ggrcAjax} from '../../plugins/ajax_extensions';
import canModel from 'can-model';
import canStache from 'can-stache';
import canList from 'can-list';
import canMap from 'can-map';
import canControl from 'can-control';
import '../../components/issue-tracker/modal-issue-tracker-fields';
import '../../components/issue-tracker/issue-tracker-switcher';
import '../../components/access-control-list/access-control-list-roles-helper';
import '../../components/assessment/assessment-people';
import '../../components/assessment/assessment-object-type-dropdown';
import '../../components/assessment-templates/assessment-template-attributes/assessment-template-attributes';
import '../../components/assessment-templates/people-list/people-list';
import '../../components/assessment-templates/template-field/template-field';
import '../../components/assessment-templates/add-template-field/add-template-field';
import '../../components/textarea-array/textarea-array';
import '../../components/object-list-item/object-list-item-updater';
import '../../components/related-objects/related-documents';
import '../../components/related-objects/related-urls';
import '../../components/spinner-component/spinner-component';
import '../../components/object-list/object-list';
import '../../components/object-list-item/document-object-list-item';
import '../../components/action-toolbar-control/action-toolbar-control';
import '../../components/effective-dates/effective-dates';
import '../../components/dropdown/dropdown-component';
import '../../components/modal-wrappers/wrapper-assessment-template';
import '../../components/autocomplete/autocomplete-component';
import '../../components/external-data-autocomplete/external-data-autocomplete';
import '../../components/person/person-data';
import '../../components/rich-text/rich-text';
import '../../components/modal-wrappers/checkbox-to-list';
import '../../components/deferred-mapper';
import '../../components/modal-wrappers/assessment-modal';
import '../../components/assessment/map-button-using-assessment-type';
import '../../components/gca-controls/gca-controls';
import '../../components/datepicker/datepicker-component';
import '../../components/external-data-autocomplete/inline-autocomplete-wrapper';
import '../../components/multi-select-label/multi-select-label';
import '../../components/proposal/create-proposal';
import '../../components/input-filter/input-filter';
import '../../components/workflow/cycle-task-modal/cycle-task-modal';
import '../../components/person-modal/person-modal';
import '../../components/custom-attributes-modal/custom-attributes-modal';
import '../../components/modal-autocomplete/modal-autocomplete';
import {
  bindXHRToButton,
  bindXHRToDisableElement,
  BUTTON_VIEW_DONE,
} from '../../plugins/utils/modals';
import {
  checkPreconditions,
  becameDeprecated,
} from '../../plugins/utils/controllers';
import {
  notifierXHR,
} from '../../plugins/utils/notifiers-utils';
import {
  getModalState,
  setModalState,
} from '../../plugins/utils/display-prefs-utils';
import Person from '../../models/business-models/person';
import Assessment from '../../models/business-models/assessment';
import {
  getInstance,
  initAuditTitle,
} from '../../plugins/utils/models-utils';
import {getUrlParams, changeHash} from '../../router';
import {getPageInstance} from '../../plugins/utils/current-page-utils';

export default canControl.extend({
  defaults: {
    preload_view: GGRC.templates_path + '/dashboard/modal_preload.stache',
    header_view: GGRC.templates_path + '/modals/modal_header.stache',
    custom_attributes_view:
    GGRC.templates_path + '/custom_attributes/modal_content.stache',
    button_view: BUTTON_VIEW_DONE,
    model: null, // model class to use when finding or creating new
    instance: null, // model instance to use instead of finding/creating (e.g. for update)
    new_object_form: false,
    add_more: false,
    ui_array: [],
    reset_visible: false,
    // used for revision-comparer
    extraCssClass: '',
    afterFetch: function () {},
    isProposal: false,
    isSaving: false, // is there a save/map operation currently in progress
  },
}, {
  init: function () {
    let userFetch;

    if (!(this.options instanceof canMap)) {
      this.options = new canMap(this.options);
    }

    if (!this.element.find('.modal-body').length) {
      ggrcAjax({
        url: this.options.preload_view,
        dataType: 'text',
      }).then((view) => {
        let frag = canStache(view)();
        this.after_preload(frag);
      });
      return;
    }

    // Make sure that the current user object, if it exists, is fully
    // loaded before rendering the form, otherwise initial validation can
    // incorrectly fail for form fields whose values rely on current user's
    // attributes.
    const currentUser = Person.findInCacheById(GGRC.current_user.id);

    if (!currentUser) {
      userFetch = Person.findOne({id: GGRC.current_user.id});
    } else if (currentUser && !currentUser.email) {
      // If email - a required attribute - is missing, the user object is
      // not fully loaded and we need to force-fetch it first - yes, it can
      // actually happen that reify() returns a partially loaded object.
      userFetch = currentUser.refresh();
    } else {
      // nothing to wait for
      userFetch = new $.Deferred().resolve(currentUser);
    }

    userFetch
      .then(() => {
        this.after_preload();
      });
  },
  after_preload: function (content) {
    if (this.wasDestroyed()) {
      return;
    }

    if (content) {
      this.element.html(content);
    }

    this.options.attr('headerEl', this.element.find('.modal-header')[0]);
    this.options.attr('contentEl', this.element.find('.modal-body')[0]);
    this.options.attr('footerEl', this.element.find('.modal-footer')[0]);
    this.on();
    this.fetch_all()
      .then(() => this.apply_object_params())
      .then(() => this.serialize_form())
      .then(() => {
        if (!this.wasDestroyed()) {
          this.element.trigger('preload');
        }
      })
      .then(() => {
        if (!this.wasDestroyed()) {
          this.options.afterFetch(this.element);
          this.restore_ui_status_from_storage();
          initAuditTitle(this.options.instance, this.options.new_object_form);
        }
      })
      .fail((error) => {
        notifierXHR('error', error);
        this.element.modal_form('hide');
      });
  },

  apply_object_params: function () {
    if (!this.options.object_params) {
      return;
    }
    this.options.object_params.each(function (value, key) {
      this.set_value({name: key, value: value});
    }, this);
  },

  fetch_templates: function (dfd) {
    return $.when(
      ggrcAjax({url: this.options.content_view, dataType: 'text'}),
      ggrcAjax({url: this.options.header_view, dataType: 'text'}),
      ggrcAjax({url: this.options.button_view, dataType: 'text'}),
      ggrcAjax({url: this.options.custom_attributes_view, dataType: 'text'}),
      dfd.then(() => this.options),
    ).then((content, header, footer, customAttributes, context) => {
      this.draw(content, header, footer, customAttributes, context);
    });
  },

  fetch_data: function () {
    let that = this;
    let dfd;
    let instance = this.options.attr('instance');

    if (this.options.skip_refresh && instance) {
      return new $.Deferred().resolve(instance);
    } else if (instance) {
      dfd = instance.refresh();
    } else if (this.options.model) {
      if (this.options.new_object_form) {
        const params = {};

        if (this.options.extendNewInstance) {
          let extendedInstance = this.options.extendNewInstance.attr ?
            this.options.extendNewInstance.attr() :
            this.options.extendNewInstance;
          Object.assign(params, extendedInstance);
        }

        dfd = $.when(this.options.attr(
          'instance',
          new this.options.model(params).attr('_suppress_errors', true)
        )).then(function () {
          instance = this.options.attr('instance');
        }.bind(this));
      }
    } else {
      this.options.attr('instance', {});
      that.on();
      dfd = new $.Deferred().resolve(instance);
    }

    dfd.then(function () {
      if (instance &&
        exists(instance, 'constructor.is_custom_attributable') &&
        !(instance instanceof Assessment)) {
        return $.when(
          instance.load_custom_attribute_definitions &&
          instance.load_custom_attribute_definitions(),
          instance.custom_attribute_values ?
            instance.refresh_all('custom_attribute_values') :
            []
        );
      }
    });

    return dfd.done(function () {
      this.reset_form(this.options.instance);
    }.bind(that));
  },

  reset_form: function (instance, setFieldsCb) {
    let preloadDfd;

    if (!this.wasDestroyed()) {
      // Do the fields (re-)setting
      if (loIsFunction(setFieldsCb)) {
        setFieldsCb();
      }
      // This is to trigger `focus_first_element` in modal_ajax handling
      this.element.trigger('loaded');
    }
    if (!instance._transient) {
      instance.attr('_transient', new canMap({}));
    }
    if (instance.form_preload) {
      preloadDfd = instance.form_preload(
        this.options.new_object_form,
        this.options.object_params,
        getPageInstance());
      if (preloadDfd) {
        preloadDfd.then(function () {
          instance.backup();
        });
      }
    }
    return preloadDfd || $.Deferred().resolve();
  },

  fetch_all: function () {
    return this.fetch_templates(this.fetch_data());
  },

  draw: function (content, header, footer, customAttributes, context) {
    if (this.wasDestroyed()) {
      return;
    }

    let modalTitle = this.options.modal_title;
    let isProposal = this.options.isProposal;
    let isObjectModal = modalTitle && (modalTitle.indexOf('Edit') === 0 ||
      modalTitle.indexOf('New') === 0);

    if (Array.isArray(content)) {
      content = content[0];
    }
    if (Array.isArray(header)) {
      header = header[0];
    }
    if (Array.isArray(footer)) {
      footer = footer[0];
    }
    if (Array.isArray(customAttributes)) {
      customAttributes = customAttributes[0];
    }
    if (header !== null) {
      header = canStache(header)(context);
      $(this.options.headerEl).find('h2').html(header);
    }
    if (content !== null) {
      content = canStache(content)(context);
      $(this.options.contentEl).html(content).removeAttr('style');
    }
    if (footer !== null) {
      footer = canStache(footer)(context);
      $(this.options.footerEl).html(footer);
    }
    if (customAttributes !== null && (isObjectModal || isProposal)) {
      customAttributes = canStache(customAttributes)(context);
      $(this.options.contentEl).append(customAttributes);
    }

    // Update UI status array
    let $form = $(this.element).find('form');
    let tabList = $form.find('[tabindex]');
    let hidableTabs = 0;
    for (let i = 0; i < tabList.length; i++) {
      if ($(tabList[i]).attr('tabindex') > 0) {
        hidableTabs++;
      }
    }
    // ui_array index is used as the tab_order, Add extra space for skipped numbers
    let storableUI = hidableTabs + 20;
    for (let i = 0; i < storableUI; i++) {
      // When we start, all the ui elements are visible
      this.options.ui_array.push(0);
    }
  },

  'input:not([data-lookup]), textarea, select change':
    function (el) {
      const instance = this.options.instance;
      if (instance.isNew && instance.isNew()) {
        if (instance.isDirty()) {
          instance.removeAttr('_suppress_errors');
        }
      } else {
        instance.removeAttr('_suppress_errors');
      }

      this.set_value_from_element(el);
    },

  'input:not([data-lookup]), textarea keyup':
    function (el, ev) {
      // TODO: If statement doesn't work properly. This is the right one:
      //       if (el.attr('value').length ||
      //          (typeof el.attr('value') !== 'undefined' && el.val().length)) {
      if (el.prop('value').length === 0 ||
        (typeof el.attr('value') !== 'undefined' &&
        !el.attr('value').length)) {
        this.set_value_from_element(el);
      }
    },

  serialize_form: function () {
    let $form = $(this.options.contentEl).find('form');
    let $elements = $form
      .find(':input:not([data-lookup])');

    $elements.toArray().forEach((el) => this.set_value_from_element(el));
  },
  set_value_from_element: function (el) {
    // If no model is specified, short circuit setting values
    // Used to support ad-hoc form elements in confirmation dialogs
    if (!this.options.model) {
      return;
    }

    const $el = $(el);
    const name = $el.attr('name');

    if (name) {
      this.set_value({name, value: $el.val()});
    }
  },
  set_value: function (item) {
    let instance = this.options.instance;
    let name = item.name.split('.');
    let $elem;
    let value;
    let model;

    if (!(instance instanceof this.options.model)) {
      instance = this.options.instance =
        new this.options.model(instance && instance.serialize ?
          instance.serialize() : instance);
    }

    $elem = $(this.options.contentEl)
      .find("[name='" + item.name + "']");
    model = $elem.attr('model');

    if (model) {
      if (item.value instanceof Array) {
        value = filteredMap(item.value, (id) => getInstance(model, id));
      } else if (item.value instanceof Object) {
        value = getInstance(model, item.value.id);
      } else {
        value = getInstance(model, item.value);
      }
    } else if ($elem.is('[type=checkbox]')) {
      value = $elem.is(':checked');
    } else {
      value = item.value;
    }

    if (name.length > 1) {
      if (Array.isArray(value)) {
        value = new canList(filteredMap(value,
          (v) => new canMap({}).attr(name.slice(1).join('.'), v)));
      } else {
        value = new canMap({}).attr(name.slice(1).join('.'), value);
      }
    }

    value = value && value.serialize ? value.serialize() : value;
    instance.attr(name[0], value);
  },
  '[data-before], [data-after] change': function (el, ev) {
    if (this.wasDestroyed()) {
      return;
    }

    let date;
    let data;
    let options;
    if (!el.data('datepicker')) {
      el.datepicker({changeMonth: true, changeYear: true});
    }
    date = el.datepicker('getDate');
    data = el.data();
    options = {
      before: 'maxDate',
      after: 'minDate',
    };

    loForEach(options, (val, key) => {
      let targetEl;
      let isInput;
      let targetDate;
      let otherKey;
      if (!data[key]) {
        return;
      }
      targetEl = this.element.find('[name=' + data[key] + ']');
      isInput = targetEl.is('input');
      targetDate = isInput ? targetEl.val() : targetEl.text();

      el.datepicker('option', val, targetDate);
      if (targetEl) {
        otherKey = key === 'before' ? 'after' : 'before';
        targetEl.datepicker('option', options[otherKey], date);
      }
    });
  },

  "{footerEl} a.btn[data-toggle='modal-submit-addmore'] click":
    function (el, ev) {
      if (el.hasClass('disabled')) {
        return;
      }
      this.options.attr('add_more', true);
      this.save_ui_status();
      this.triggerSave(el, ev);
    },

  "{footerEl} a.btn[data-toggle='modal-submit'] click": function (el, ev) {
    let options = this.options;
    let instance = options.attr('instance');
    let oldData = options.attr('oldData');
    let applyPreconditions = options.attr('applyPreconditions');
    let saveInstance = function () {
      options.attr('add_more', false);
      this.triggerSave(el, ev);
    }.bind(this);

    if (el.hasClass('disabled')) {
      return;
    }

    if (applyPreconditions) {
      checkPreconditions({
        instance: instance,
        operation: 'deprecation',
        // functions that will be called as an extra conditions (return true
        // or false). If all conditions are passed then are showed a
        // message else - called success handler.
        extraConditions: [
          becameDeprecated.bind(
            null,
            instance,
            oldData.status,
          ),
        ],
      }, saveInstance);
    } else {
      saveInstance();
    }
  },

  '{contentEl} a.field-hide click': function (el, ev) { // field hide
    let $el = $(el);
    let totalInner = $el.closest('.hide-wrap.hidable')
      .find('.inner-hide').length;
    let totalHidden;
    let uiUnit;
    let i;
    let tabValue;
    let $hidable = [
      'span',
      'ggrc-form-item',
    ].map((className) => $el.closest(`[class*="${className}"].hidable`))
      .find((item) => item.length > 0);

    $el.closest('.inner-hide').addClass('inner-hidable');
    totalHidden = $el.closest('.hide-wrap.hidable')
      .find('.inner-hidable').length;

    $hidable.addClass('hidden');
    this.options.attr('reset_visible', true);
    // update ui array
    uiUnit = $hidable.find('[tabindex]');
    for (i = 0; i < uiUnit.length; i++) {
      tabValue = $(uiUnit[i]).attr('tabindex');
      if (tabValue > 0) {
        this.options.ui_array[tabValue - 1] = 1;
        $(uiUnit[i]).attr('tabindex', '-1');
        $(uiUnit[i]).attr('uiindex', tabValue);
      }
    }

    if (totalInner === totalHidden) {
      $el.closest('.inner-hide').parent('.hidable').addClass('hidden');
    }

    return false;
  },

  '{contentEl} #formHide click': function () {
    if (this.wasDestroyed()) {
      return false;
    }

    let i;
    let uiArrLength = this.options.ui_array.length;
    let $hidables = this.element.find('.hidable');
    let hiddenElements = $hidables.find('[tabindex]');
    let $hiddenElement;
    let tabValue;
    for (i = 0; i < uiArrLength; i++) {
      this.options.ui_array[i] = 0;
    }

    this.options.attr('reset_visible', true);

    $hidables.addClass('hidden');
    this.element.find('.inner-hide').addClass('inner-hidable');

    // Set up the hidden elements index to 1
    for (i = 0; i < hiddenElements.length; i++) {
      $hiddenElement = $(hiddenElements[i]);
      tabValue = $hiddenElement.attr('tabindex');
      // The UI array index start from 0, and tab-index/io-index is from 1
      if (tabValue > 0) {
        this.options.ui_array[tabValue - 1] = 1;
        $hiddenElement.attr({
          tabindex: '-1',
          uiindex: tabValue,
        });
      }
    }

    return false;
  },

  '{contentEl} #formRestore click': function () {
    if (this.wasDestroyed()) {
      return false;
    }

    // Update UI status array to initial state
    let i;
    let uiArrLength = this.options.ui_array.length;
    let $form = this.element.find('form');
    let $body = $form.closest('.modal-body');
    let uiElements = $body.find('[uiindex]');
    let $el;
    let tabVal;

    for (i = 0; i < uiArrLength; i++) {
      this.options.ui_array[i] = 0;
    }

    // Set up the correct tab index for tabbing
    // Get all the ui elements with 'uiindex' set to original tabindex
    // Restore the original tab index

    for (i = 0; i < uiElements.length; i++) {
      $el = $(uiElements[i]);
      tabVal = $el.attr('uiindex');
      $el.attr('tabindex', tabVal);
    }

    this.options.attr('reset_visible', false);
    this.element.find('.hidden').removeClass('hidden');
    this.element.find('.inner-hide').removeClass('inner-hidable');
    return false;
  },

  save_ui_status: function () {
    if (!this.options.model) {
      return;
    }
    let modelName = this.options.model.model_singular;
    let resetVisible = this.options.reset_visible ?
      this.options.reset_visible : false;
    let uiArray = this.options.ui_array ? this.options.ui_array : [];
    let displayState = {
      reset_visible: resetVisible,
      ui_array: uiArray,
    };

    setModalState(modelName, displayState);
  },

  restore_ui_status_from_storage: function () {
    if (!this.options.model) {
      return;
    }
    let modelName = this.options.model.model_singular;
    let displayState = getModalState(modelName);

    // set up reset_visible and ui_array
    if (displayState !== null) {
      if (displayState.reset_visible) {
        this.options.attr('reset_visible', displayState.reset_visible);
      }
      if (displayState.ui_array) {
        this.options.ui_array = displayState.ui_array.slice();
      }
    }
    this.restore_ui_status();
  },

  restore_ui_status: function () {
    if (this.wasDestroyed()) {
      return;
    }

    let $selected;
    let str;
    let tabindex;
    let i;
    let $form;
    let $body;

    // walk through the ui_array, for the one values,
    // select the element with tab index and hide it

    if (this.options.attr('reset_visible')) {// some elements are hidden
      $form = this.element.find('form');
      $body = $form.closest('.modal-body');

      for (i = 0; i < this.options.ui_array.length; i++) {
        if (this.options.ui_array[i] === 1) {
          tabindex = i + 1;
          str = '[tabindex=' + tabindex + ']';
          $selected = $body.find(str);

          if ($selected) {
            $selected.closest('.hidable').addClass('hidden');
            $selected.attr({
              uiindex: tabindex,
              tabindex: '-1',
            });
          }
        }
      }

      return false;
    }
  },

  triggerSave(el, ev) {
    if (this.wasDestroyed()) {
      return;
    }

    // disable ui while the form is being processed (loading)
    this.disableEnableContentUI(true);

    // Normal saving process
    if (el.is(':not(.disabled)')) {
      const ajd = this.save_instance(el, ev);

      if (!ajd) {
        return;
      }

      const saveCloseBtn = this.element.find('a.btn[data-toggle=modal-submit]');
      const modalBackdrop = this.element.data('modal_form').$backdrop;
      const modalCloseBtn = this.element.find('.modal-dismiss > .fa-times');
      const deleteBtn = this.element.find(
        'a.btn[data-toggle=modal-ajax-deleteform]'
      );
      const saveAddmoreBtn = this.element.find(
        'a.btn[data-toggle=modal-submit-addmore]'
      );

      this.options.attr('isSaving', true);

      ajd.always(() => {
        this.options.attr('isSaving', false);
        initAuditTitle(this.options.instance, this.options.new_object_form);
      });
      if (this.options.add_more) {
        bindXHRToButton(ajd, saveCloseBtn);
        bindXHRToButton(ajd, saveAddmoreBtn, 'Saving, please wait...');
      } else {
        bindXHRToButton(ajd, saveCloseBtn, 'Saving, please wait...');
        bindXHRToButton(ajd, saveAddmoreBtn);
      }

      bindXHRToDisableElement(ajd, deleteBtn);
      bindXHRToDisableElement(ajd, modalBackdrop);
      bindXHRToDisableElement(ajd, modalCloseBtn);
    }
  },

  new_instance: function (data) {
    let newInstance = this.prepareInstance();

    this.reset_form(newInstance, () => {
      if (this.wasDestroyed()) {
        return;
      }

      let $form = $(this.element).find('form');
      $form.trigger('reset');
    }).done(() => {
      $.when(this.options.attr('instance', newInstance))
        .then(() => this.apply_object_params())
        .then(() => this.serialize_form())
        .then(() => this.options.attr('instance').backup());
    });

    this.restore_ui_status();
  },

  prepareInstance: function () {
    let instance = new this.options.model({});
    let saveContactModels = ['TaskGroup', 'TaskGroupTask'];

    instance.attr('_suppress_errors', true);

    if (this.options.add_more &&
      saveContactModels.includes(this.options.model.model_singular)) {
      instance.attr('contact', this.options.attr('instance.contact'));
    }

    return instance;
  },

  save_instance: function (el, ev) {
    let that = this;
    let instance = this.options.instance;
    let ajd;

    if (this.wasDestroyed()) {
      return $.Deferred().reject();
    }

    if (instance.getInstanceErrors()) {
      instance.removeAttr('_suppress_errors');
      return;
    }

    this.serialize_form();

    // Special case to handle context outside the form itself
    // - this avoids duplicated change events, and the API requires
    //   `context` to be present even if `null`, unlike other attributes
    if (!instance.context) {
      instance.attr('context', {id: null});
    }

    this.disable_hide = true;

    ajd = instance.save();
    ajd.fail(this.save_error.bind(this))
      .done(function (obj) {
        // enable ui after clicking on save & other
        that.disableEnableContentUI(false);
        delete that.disable_hide;
        if (that.options.add_more) {
          if (that.options.$trigger && that.options.$trigger.length) {
            that.options.$trigger.trigger('modal:added', [obj]);
          }
          that.new_instance();
        } else {
          that.element.trigger('modal:success', [obj])
            .modal_form('hide');
          that.update_hash_fragment();
        }
      });
    this.save_ui_status();
    return ajd;
  },

  save_error: function (_, error) {
    if (error) {
      if (error.status !== 409) {
        notifierXHR('error', error);
      } else {
        clearTimeout(error.warningId);
        notifierXHR('warning', error);
      }
    }
    // enable ui after a fail
    this.disableEnableContentUI(false);

    $('html, body').animate({
      scrollTop: '0px',
    }, {
      duration: 200,
      complete: function () {
        delete this.disable_hide;
      }.bind(this),
    });
  },

  '{instance} destroyed': ' hide',

  ' hide': function (el, ev) {
    if (this.wasDestroyed()) {
      return;
    }

    let cad;
    const instance = this.options.instance;
    if (this.disable_hide) {
      ev.stopImmediatePropagation();
      ev.stopPropagation();
      ev.preventDefault();
      return false;
    }
    if (instance instanceof canModel &&
      // Ensure that this modal was hidden and not a child modal
      this.element && ev.target === this.element[0] &&
      !this.options.skip_refresh && !instance.isNew()) {
      if (instance.type === 'AssessmentTemplate') {
        cad = instance.attr('custom_attribute_definitions');
        cad = loFilter(cad, function (attr) {
          return attr.id;
        });
        instance.attr('custom_attribute_definitions', cad);
      }
      instance.notifier.onEmpty(() => {
        instance.refresh();
      });
    }
  },

  destroy: function () {
    if (this.options.model && this.options.model.cache) {
      delete this.options.model.cache[undefined];
    }
    if (this._super) {
      this._super(...arguments);
    }
    if (this.options.instance && this.options.instance._transient) {
      this.options.instance.removeAttr('_transient');
    }
  },

  should_update_hash_fragment: function () {
    let $trigger = this.options.$trigger;

    if (!$trigger) {
      return false;
    }
    return $trigger.data('updateHash') ||
      !$trigger.closest('.modal, .pin-content').length;
  },

  update_hash_fragment: function () {
    let hash;
    if (!this.should_update_hash_fragment()) {
      return;
    }

    if (this.options.instance.getHashFragment) {
      hash = this.options.instance.getHashFragment();
      if (hash) {
        changeHash(getUrlParams(hash));
      }
    }
  },

  /**
   * disable/enable ui to disallow/allow user to edit input elements
   * after clicking on the save button
   *  @param {boolean} isDisabled
   */
  disableEnableContentUI(isDisabled = false) {
    const content = $(this.options.attr('contentEl'));

    if (!content) {
      return;
    }

    if (isDisabled) {
      content.addClass('ui-disabled');
    } else {
      content.removeClass('ui-disabled');
    }
  },
  /**
   * @return {boolean} - true, if modal was destroyed, otherwise - false
   */
  wasDestroyed() {
    return !this.element;
  },
});
