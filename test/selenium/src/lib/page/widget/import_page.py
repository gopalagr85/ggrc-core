# Copyright (C) 2019 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
"""Represents import page."""
from lib import base, environment
from lib.page.modal import download_template
from lib.utils import selenium_utils


class ImportPage(base.WithBrowser):
  """Import page."""

  def __init__(self, driver=None):
    super(ImportPage, self).__init__(driver)
    self.import_page_url = environment.app_url + "import"

  def open(self):
    """Opens import page."""
    selenium_utils.open_url(self.import_page_url)

  @property
  def download_import_template_btn(self):
    """Returns 'Download import template' button page element."""
    return self._browser.element(tag_name="download-template")

  def open_download_template_modal(self):
    """Clicks on 'Download import template' button.
    Returns 'Download template' modal page."""
    self.download_import_template_btn.click()
    return download_template.DownloadTemplateModal()
