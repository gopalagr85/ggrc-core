# Copyright (C) 2019 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Test imports of mappings between objects"""

from collections import OrderedDict
import mock

import ddt

from ggrc.converters import errors
from ggrc.utils import title_from_camelcase
from integration.ggrc import (TestCase, MAPPING_SCOPE_PAIRS,
                              MAPPING_REGULATION_PAIRS, MAPPING_STANDARD_PAIRS)
from integration.ggrc import factories


@ddt.ddt
class TestImportMappings(TestCase):
  """Test import mapping/unmapping"""

  def setUp(self):
    super(TestImportMappings, self).setUp()
    self.client.get("/login")

  @staticmethod
  def _get_import_data(model1, model2, unmap):
    """Returns data for csv import of the respective objects"""
    name1 = model1.__name__
    name2 = model2.__name__
    title1 = title_from_camelcase(name1)

    with factories.single_commit():
      with mock.patch('ggrc.models.relationship.is_external_app_user',
                      return_value=True):
        obj1 = factories.get_model_factory(name1)()
        obj2 = factories.get_model_factory(name2)()
        if unmap:
          factories.RelationshipFactory(source=obj1, destination=obj2,
                                        is_external=True)
        slug1 = obj1.slug
        slug2 = obj2.slug

    data_block = [
        OrderedDict([
            ("object_type", name1),
            ("Code*", slug1),
        ]),
        OrderedDict([
            ("object_type", name2),
            ("Code*", slug2),
            ("{}:{}".format("unmap" if unmap else "map", title1), slug1),
        ]),
    ]
    return data_block

  def _get_import_csv_response(self, model1, model2, unmap=True):
    """Returns import csv response of the respective objects"""
    data_block = self._get_import_data(model1, model2, unmap)
    return self.import_data(*data_block)

  @ddt.data(*MAPPING_SCOPE_PAIRS)
  @ddt.unpack
  def test_unmap_scope_objects(self, model1, model2):
    """Test deprecated unmapping between {0.__name__} and {1.__name__}
    """
    response = self._get_import_csv_response(model1, model2)
    obj1 = model1.__name__
    obj2 = title_from_camelcase(model2.__name__).title()

    # Check that mapping is not added
    self.assertEqual(len(response[1]['row_warnings']), 1)
    self._check_csv_response([response[1]], {
        obj2: {
            "row_warnings": {
                errors.MAP_UNMAP_SCOPE_ERROR.format(
                    line=7,
                    object_type=obj1,
                ),
            },
        },
    })

  @ddt.data(*MAPPING_REGULATION_PAIRS)
  @ddt.unpack
  def test_unmap_regulation_objects(self, model1, model2):
    """Test deprecated unmapping between {0.__name__} and {1.__name__}
    """
    response = self._get_import_csv_response(model1, model2)
    obj1 = model1.__name__
    obj2 = title_from_camelcase(model2.__name__).title()

    # Check that mapping is not added
    self.assertEqual(len(response[1]['row_warnings']), 1)
    self._check_csv_response([response[1]], {
        obj2: {
            "row_warnings": {
                errors.MAP_UNMAP_REGULATION_ERROR.format(
                    line=7,
                    object_type=obj1,
                ),
            },
        },
    })

  @ddt.data(*MAPPING_STANDARD_PAIRS)
  @ddt.unpack
  def test_unmap_standard_objects(self, model1, model2):
    """Test deprecated unmapping between {0.__name__} and {1.__name__}
    """
    response = self._get_import_csv_response(model1, model2)
    obj1 = model1.__name__
    obj2 = title_from_camelcase(model2.__name__).title()

    # Check that mapping is not added
    self.assertEqual(len(response[1]['row_warnings']), 1)
    self._check_csv_response([response[1]], {
        obj2: {
            "row_warnings": {
                errors.MAP_UNMAP_STANDARD_ERROR.format(
                    line=7,
                    object_type=obj1,
                ),
            },
        },
    })

  @ddt.data(*MAPPING_SCOPE_PAIRS)
  @ddt.unpack
  def test_map_scope_objects(self, model1, model2):
    """Test deprecated mapping between {0.__name__} and {1.__name__}
    """
    response = self._get_import_csv_response(model1, model2, unmap=False)
    obj1 = model1.__name__
    obj2 = title_from_camelcase(model2.__name__).title()

    self.assertEqual(len(response[1]['row_warnings']), 1)
    self._check_csv_response([response[1]], {
        obj2: {
            "row_warnings": {
                errors.MAP_UNMAP_SCOPE_ERROR.format(
                    line=7,
                    object_type=obj1,
                ),
            },
        },
    })

  @ddt.data(*MAPPING_REGULATION_PAIRS)
  @ddt.unpack
  def test_map_regulation_objects(self, model1, model2):
    """Test deprecated mapping between {0.__name__} and {1.__name__}
    """
    response = self._get_import_csv_response(model1, model2, unmap=False)
    obj1 = model1.__name__
    obj2 = title_from_camelcase(model2.__name__).title()

    self.assertEqual(len(response[1]['row_warnings']), 1)
    self._check_csv_response([response[1]], {
        obj2: {
            "row_warnings": {
                errors.MAP_UNMAP_REGULATION_ERROR.format(
                    line=7,
                    object_type=obj1,
                ),
            },
        },
    })

  @ddt.data(*MAPPING_STANDARD_PAIRS)
  @ddt.unpack
  def test_map_standard_objects(self, model1, model2):
    """Test deprecated mapping between {0.__name__} and {1.__name__}
    """
    response = self._get_import_csv_response(model1, model2, unmap=False)
    obj1 = model1.__name__
    obj2 = title_from_camelcase(model2.__name__).title()

    self.assertEqual(len(response[1]['row_warnings']), 1)
    self._check_csv_response([response[1]], {
        obj2: {
            "row_warnings": {
                errors.MAP_UNMAP_STANDARD_ERROR.format(
                    line=7,
                    object_type=obj1,
                ),
            },
        },
    })
