/*
    Copyright (C) 2019 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

import canMap from 'can-map';
import Mixin from './mixin';
import * as issueTrackerUtils from '../../plugins/utils/issue-tracker-utils';

export default Mixin.extend(
  issueTrackerUtils.issueTrackerStaticFields,
  {
    'after:init'() {
      this.initIssueTracker();
    },
    'before:refresh'() {
      issueTrackerUtils.cleanUpWarnings(this);
    },
    after_refresh() {
      this.initIssueTracker();
    },
    after_save() {
      issueTrackerUtils.checkWarnings(this);
    },
    initIssueTracker() {
      if (!GGRC.ISSUE_TRACKER_ENABLED) {
        return;
      }

      if (!this.issue_tracker) {
        this.attr('issue_tracker', new canMap({}));
      }

      let config = this.constructor.buildIssueTrackerConfig
        ? this.constructor.buildIssueTrackerConfig(this)
        : {enabled: false};

      issueTrackerUtils.initIssueTrackerObject(
        this,
        config,
        true
      );
    },
    issueCreated() {
      return GGRC.ISSUE_TRACKER_ENABLED
        && issueTrackerUtils.isIssueCreated(this);
    },
    issueTrackerEnabled() {
      return GGRC.ISSUE_TRACKER_ENABLED
        && issueTrackerUtils.isIssueTrackerEnabled(this);
    },
  },
);
