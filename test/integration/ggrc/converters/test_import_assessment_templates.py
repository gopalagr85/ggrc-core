# Copyright (C) 2019 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

# pylint: disable=maybe-no-member

"""Test Assessment Template import."""

from collections import OrderedDict
from ggrc import models
from ggrc.converters import errors
from ggrc.utils import errors as common_errors
from integration.ggrc import TestCase
from integration.ggrc.models import factories


class TestAssessmentTemplatesImport(TestCase):
  """Assessment Template import tests."""

  def setUp(self):
    """Set up for Assessment Template test cases."""
    super(TestAssessmentTemplatesImport, self).setUp()
    self.client.get("/login")

  def test_valid_import(self):
    """Test valid import."""
    response = self.import_file("assessment_template_no_warnings.csv")
    expected_messages = {
        "Assessment Template": {
            "rows": 4,
            "updated": 0,
            "created": 4,
        }
    }
    self._check_csv_response(response, expected_messages)

    people = {p.email: p.id for p in models.Person.query.all()}
    template = models.AssessmentTemplate.query \
        .filter(models.AssessmentTemplate.slug == "T-2") \
        .first()

    self.assertEqual(
        template.default_people["verifiers"],
        [people["user3@a.com"], people["user1@a.com"]],
    )
    self.assertEqual(
        template.procedure_description,
        "Some test plan"
    )

  def test_modify_over_import(self):
    """Test import modifies Assessment Template and does not fail."""
    self.import_file("assessment_template_no_warnings.csv")
    slug = "T-1"
    response = self.import_data(OrderedDict([
        ("object_type", "Assessment_Template"),
        ("Code*", slug),
        ("Audit*", "Audit"),
        ("Title", "Title"),
        ("Object Under Assessment", 'Control'),
    ]))
    template = models.AssessmentTemplate.query \
        .filter(models.AssessmentTemplate.slug == slug) \
        .first()
    self._check_csv_response(response, {})
    self.assertEqual(template.default_people['verifiers'], 'Auditors')
    self.assertEqual(template.default_people['assignees'], 'Admin')

  def test_modify_persons_over_import(self):
    """Test import modifies Assessment Template and does not fail."""
    self.import_file("assessment_template_no_warnings.csv")
    slug = "T-1"
    response = self.import_data(OrderedDict([
        ("object_type", "Assessment_Template"),
        ("Code*", slug),
        ("Audit*", "Audit"),
        ("Title", "Title"),
        ("Object Under Assessment", "Control"),
        ("Default Verifiers", "Secondary Contacts")
    ]))
    template = models.AssessmentTemplate.query \
        .filter(models.AssessmentTemplate.slug == slug) \
        .first()
    self._check_csv_response(response, {})
    self.assertEqual(template.default_people["verifiers"],
                     "Secondary Contacts")

  def test_invalid_import(self):
    """Test invalid import."""
    data = "assessment_template_with_warnings_and_errors.csv"
    response = self.import_file(data, safe=False)

    expected_messages = {
        "Assessment Template": {
            "rows": 7,
            "updated": 0,
            "created": 6,
            "row_warnings": {
                errors.UNKNOWN_USER_WARNING.format(
                    line=12,
                    column_name="Default Verifiers",
                    email="user3@a.com",
                ),
                errors.UNKNOWN_USER_WARNING.format(
                    line=12,
                    column_name="Default Verifiers",
                    email="user1@a.com"
                ),
                errors.WRONG_VALUE.format(
                    line=16,
                    column_name="Custom Attributes"
                ),
                errors.WRONG_VALUE.format(
                    line=17,
                    column_name="Custom Attributes"
                )
            },
            "row_errors": {
                errors.ERROR_TEMPLATE.format(
                    line=15,
                    message=common_errors.DUPLICATE_RESERVED_NAME.format(
                        attr_name="ASSESSMENT PROCEDURE"
                    ),
                )
            },
        }
    }
    self._check_csv_response(response, expected_messages)

  def test_duplicated_gcad_import(self):
    """Test import of LCAD with same name as GCAD."""
    cad_title = "Test GCA"
    with factories.single_commit():
      factories.CustomAttributeDefinitionFactory(
          definition_type="assessment",
          title=cad_title,
      )
      audit = factories.AuditFactory()

    response = self.import_data(OrderedDict([
        ("object_type", "Assessment_Template"),
        ("Code*", ""),
        ("Audit*", audit.slug),
        ("Default Assignees", "user@example.com"),
        ("Default Verifiers", "user@example.com"),
        ("Title", "Title"),
        ("Object Under Assessment", "Control"),
        ("Custom Attributes", "Text, {}".format(cad_title)),
    ]))

    expected_messages = {
        "Assessment Template": {
            "rows": 1,
            "updated": 0,
            "created": 0,
            "row_warnings": set(),
            "row_errors": {
                errors.ERROR_TEMPLATE.format(
                    line=3,
                    message=common_errors.DUPLICATE_GCAD_NAME.format(
                        attr_name=cad_title
                    ),
                )
            },
        }
    }
    self._check_csv_response(response, expected_messages)

  def test_duplicated_acr_import(self):
    """Test import of LCAD with same name as GCAD."""
    acr_name = "Test ACR"
    with factories.single_commit():
      factories.AccessControlRoleFactory(
          object_type="Assessment",
          name=acr_name,
      )
      audit = factories.AuditFactory()

    response = self.import_data(OrderedDict([
        ("object_type", "Assessment_Template"),
        ("Code*", ""),
        ("Audit*", audit.slug),
        ("Default Assignees", "user@example.com"),
        ("Default Verifiers", "user@example.com"),
        ("Title", "Title"),
        ("Object Under Assessment", "Control"),
        ("Custom Attributes", "Text, {}".format(acr_name)),
    ]))

    expected_messages = {
        "Assessment Template": {
            "rows": 1,
            "updated": 0,
            "created": 0,
            "row_warnings": set(),
            "row_errors": {
                errors.ERROR_TEMPLATE.format(
                    line=3,
                    message=common_errors.DUPLICATE_CUSTOM_ROLE.format(
                        role_name=acr_name
                    ),
                )
            },
        }
    }
    self._check_csv_response(response, expected_messages)
