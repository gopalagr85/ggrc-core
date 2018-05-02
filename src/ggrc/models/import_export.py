# Copyright (C) 2018 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

""" ImportExport model."""

import json
from datetime import datetime

from sqlalchemy.dialects import mysql
from sqlalchemy import exists, and_

from ggrc import db
from ggrc.models.mixins.base import Identifiable
from ggrc.login import get_current_user
from werkzeug.exceptions import BadRequest, Forbidden, NotFound


class ImportExport(Identifiable, db.Model):
  """ImportExport Model."""

  __tablename__ = 'import_exports'

  IMPORT_JOB_TYPE = 'Import'
  EXPORT_JOB_TYPE = 'Export'

  ANALYSIS_STATUS = 'Analysis'
  BLOCKED_STATUS = 'Blocked'
  IN_PROGRESS_STATUS = 'In Progress'
  NOT_STARTED_STATUS = 'Not Started'


  IMPORT_EXPORT_STATUSES = [
      NOT_STARTED_STATUS,
      ANALYSIS_STATUS,
      IN_PROGRESS_STATUS,
      BLOCKED_STATUS,
      'Analysis Failed',
      'Stopped',
      'Failed',
      'Finished',
  ]

  job_type = db.Column(db.Enum(IMPORT_JOB_TYPE, EXPORT_JOB_TYPE), nullable=False)
  status = db.Column(db.Enum(*IMPORT_EXPORT_STATUSES), nullable=False,
                     default=NOT_STARTED_STATUS)
  description = db.Column(db.Text)
  created_at = db.Column(db.DateTime, nullable=False)
  start_at = db.Column(db.DateTime)
  end_at = db.Column(db.DateTime)
  created_by_id = db.Column(db.Integer,
                            db.ForeignKey('people.id'), nullable=False)
  created_by = db.relationship('Person',
                               foreign_keys='ImportExport.created_by_id',
                               uselist=False)
  results = db.Column(mysql.LONGTEXT)
  title = db.Column(db.Text)
  content = db.Column(mysql.LONGTEXT)
  gdrive_metadata = db.Column('gdrive_metadata', db.Text)

  def log_json(self):
    """JSON representation"""
    res = {column.name: getattr(self, column.name)
           for column in self.__table__.columns
           if column.name not in ('content', 'gdrive_metadata')}
    if self.results:
      res['results'] = json.loads(self.results)
    res['created_at'] = self.created_at.isoformat()
    return res


def create_import_export_entry(**kwargs):
  """Create ImportExport entry"""
  meta = json.dumps(kwargs['gdrive_metadata']) if 'gride_metadata' in kwargs \
      else None
  results = json.dumps(kwargs['results']) if 'results' in kwargs else None
  ie_job = ImportExport(job_type=kwargs.get('job_type', 'Import'),
                        status=kwargs.get('status', 'Not Started'),
                        created_at=datetime.now(),
                        created_by=get_current_user(),
                        title=kwargs.get('title'),
                        content=kwargs.get('content'),
                        gdrive_metadata=meta,
                        results=results)

  db.session.add(ie_job)
  db.session.commit()
  return ie_job


def get_jobs(job_type, ids=None):
  """Get list of jobs by type and/or ids"""
  conditions = [ImportExport.created_by == get_current_user(),
                ImportExport.job_type == job_type]
  if ids:
    conditions.append(ImportExport.id.in_(ids))
  return [ie.log_json() for ie in ImportExport.query.filter(
      *conditions)]


def delete_previous_imports():
  """Delete not finished imports"""

  active_jobs = db.session.query(exists().where(
      and_(ImportExport.created_by == get_current_user(),
           and_(ImportExport.job_type == ImportExport.IMPORT_JOB_TYPE,
                ImportExport.status.in_([ImportExport.ANALYSIS_STATUS,
                                         ImportExport.IN_PROGRESS_STATUS])))
      )).scalar()
  if active_jobs:
    raise BadRequest('Import in progress')

  ImportExport.query.filter(
      ImportExport.created_by == get_current_user(),
      ImportExport.job_type == ImportExport.IMPORT_JOB_TYPE,
      ImportExport.status.in_([ImportExport.NOT_STARTED_STATUS,
                               ImportExport.BLOCKED_STATUS])
      ).delete(synchronize_session=False)
  db.session.commit()


def get(ie_id):
  """Get import_exports entry by id if entry belongs to current user"""
  ie_job = ImportExport.query.get(ie_id)
  if not ie_job:
    raise NotFound()
  if ie_job.created_by == get_current_user():
    return ie_job
  raise Forbidden()
