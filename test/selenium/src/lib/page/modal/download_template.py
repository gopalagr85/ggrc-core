# Copyright (C) 2019 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
"""Modal for downloading templates."""
from lib import base

SELECT_ALL_OPTION = "Select all"


class DownloadTemplateModal(base.Modal):
  """Modal for choosing and downloading templates."""

  def __init__(self, driver=None):
    super(DownloadTemplateModal, self).__init__(driver)
    self._root = self._browser.element(class_name="download-template")

  @property
  def dropdown(self):
    """Returns dropdown page element for choosing templates."""
    return self._root.element(class_name="multiselect-dropdown")

  def expand_dropdown(self):
    """Clicks on dropdown element if it is not expanded."""
    if not self.is_dropdown_expanded:
      self.dropdown.click()

  @property
  def is_dropdown_expanded(self):
    """Returns whether dropdown element is expanded."""
    return self.dropdown.element(class_name="dropdown-focus").exists

  @property
  def available_templates_list(self):
    """Returns list of templates available for downloading."""
    self.expand_dropdown()
    return sorted(self.dropdown.text.lower().splitlines())
