/*
    Copyright (C) 2019 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

import loUniq from 'lodash/uniq';
import loMap from 'lodash/map';
import loFilter from 'lodash/filter';
import canStache from 'can-stache';
import canMap from 'can-map';
import canComponent from 'can-component';
import tracker from '../../tracker';
import RefreshQueue from '../../models/refresh_queue';
import template from './templates/assessment-generator-button.stache';
import {getPageInstance} from '../../plugins/utils/current-page-utils';
import BackgroundTask from '../../models/service-models/background-task';
import Assessment from '../../models/business-models/assessment';

export default canComponent.extend({
  tag: 'assessment-generator-button',
  view: canStache(template),
  leakScope: true,
  viewModel: canMap.extend({
    audit: null,
    button: '',
  }),
  events: {
    'a click': function (el, ev) {
      let instance = this.viewModel.attr('audit') || getPageInstance();
      this._results = null;
      tracker.start(tracker.FOCUS_AREAS.ASSESSMENT,
        tracker.USER_JOURNEY_KEYS.LOADING,
        tracker.USER_ACTIONS.ASSESSMENT.OPEN_ASMT_GEN_MODAL);

      import(/* webpackChunkName: "mapper" */ '../../controllers/mapper/mapper')
        .then((mapper) => {
          mapper.ObjectGenerator.launch(el, {
            object: 'Audit',
            type: 'Control',
            'join-object-id': instance.id,
            relevantTo: [{
              readOnly: true,
              type: instance.type,
              id: instance.id,
              title: instance.title,
            }],
            callback: this.generateAssessments.bind(this),
          });
        });
    },
    showFlash: function (status) {
      let flash = {};
      let type;
      let redirectLink;
      let messages = {
        error: 'Assessment generation has failed.',
        progress: 'Assessment generation is in progress. This may take ' +
        'several minutes.',
        success: 'Assessment was generated successfully. {reload_link}',
      };
      if (status.Failure) {
        type = 'error';
      } else if (status.Pending || status.Running) {
        type = 'progress';
      } else {
        type = 'success';
        redirectLink = window.location.pathname + '#assessment';
      }

      flash[type] = messages[type];
      $('body').trigger('ajax:flash', [flash, redirectLink]);
    },
    updateStatus: function (id, count) {
      let wait = [2, 4, 8, 16, 32, 64];
      if (count >= wait.length) {
        count = wait.length - 1;
      }
      BackgroundTask.findOne({id: id})
        .then(function (task) {
          let status = {[task.status]: true};
          this.showFlash(status);
          if (status.Pending || status.Running) {
            setTimeout(function () {
              this.updateStatus(id, ++count);
            }.bind(this), wait[count] * 1000);
          }
        }.bind(this))
        .fail(function () {
          setTimeout(function () {
            this.updateStatus(id, ++count);
          }.bind(this), wait[count] * 1000);
        }.bind(this));
    },
    generateAssessments: function (list, options) {
      let que = new RefreshQueue();

      this._results = null;
      que.enqueue(list).trigger().then(function (items) {
        let results = loMap(items, function (item) {
          let id = options.assessmentTemplate.split('-')[0];
          return this.generateModel(item, id);
        }.bind(this));
        this._results = results;
        $.when(...results)
          .then(function () {
            let tasks = arguments;
            let ids;
            this.showFlash({Pending: true});
            options.context.closeModal();
            if (!tasks.length || tasks[0] instanceof Assessment) {
              // We did not create a task
              window.location.reload();
              return;
            }
            ids = loUniq(loMap(arguments, function (task) {
              return task.id;
            }));
            this.updateStatus(ids[0], 0);
          }.bind(this));
      }.bind(this));
    },
    generateModel: function (object, template) {
      let assessmentModel;
      let audit = this.viewModel.attr('audit');
      let title = 'Generated Assessment for ' + audit.title;
      let data = {
        _generated: true,
        audit,
        // Provide actual Snapshot Object for Assessment
        object: {
          id: object.id,
          type: 'Snapshot',
          href: object.selfLink,
        },
        context: audit.context,
        title: title,
        assessment_type: object.child_type,
      };
      data.run_in_background = true;

      if (template) {
        data.template = {
          id: Number(template),
          type: 'AssessmentTemplate',
        };
      }
      assessmentModel = new Assessment(data);

      // force remove issue_tracker field
      delete assessmentModel.issue_tracker;

      return assessmentModel.save();
    },
    notify: function () {
      let success;
      let errors;
      let msg;

      if (!this._results) {
        return;
      }
      success = loFilter(this._results, function (assessment) {
        return assessment !== null &&
          !(assessment.state && assessment.state() === 'rejected');
      }).length;
      errors = loFilter(this._results, function (assessment) {
        return assessment.state && assessment.state() === 'rejected';
      }).length;

      if (errors < 1) {
        if (success === 0) {
          msg = {
            success: 'Every Control already has an Assessment!',
          };
        } else {
          msg = {
            success: success + ' Assessments successfully created.',
          };
        }
      } else {
        msg = {
          error: 'An error occurred when creating Assessments.',
        };
      }

      $(document.body).trigger('ajax:flash', msg);
    },
  },
});
