"""
Pipeline Engine — Executes ETL pipelines
"""

import uuid
import json
import logging
import subprocess
from datetime import datetime
from ..storage.metadata_store import MetadataStore

logger = logging.getLogger('pipeline-engine')
store = MetadataStore()


class PipelineEngine:
    def create_pipeline(self, name, steps, source_id, user_id):
        pipeline_id = str(uuid.uuid4())
        pipeline = {
            'id': pipeline_id,
            'name': name,
            'steps': steps,
            'source_id': source_id,
            'created_by': user_id,
            'created_at': datetime.utcnow().isoformat(),
            'status': 'active',
        }
        store.save('pipelines', pipeline_id, pipeline)
        return pipeline

    def run_pipeline(self, pipeline_id, params=None, user_id=None):
        pipeline = store.get('pipelines', pipeline_id)
        if not pipeline:
            raise ValueError('Pipeline not found')

        run_id = str(uuid.uuid4())
        run = {
            'id': run_id,
            'pipeline_id': pipeline_id,
            'params': params or {},
            'started_by': user_id,
            'started_at': datetime.utcnow().isoformat(),
            'status': 'running',
            'steps_completed': [],
            'errors': [],
        }
        store.save('pipeline_runs', run_id, run)

        try:
            for i, step in enumerate(pipeline['steps']):
                logger.info(f"Executing step {i+1}/{len(pipeline['steps'])}: {step.get('type')}")
                result = self._execute_step(step, params, run)
                run['steps_completed'].append({'step': i, 'type': step['type'], 'result': result})

            run['status'] = 'completed'
            run['completed_at'] = datetime.utcnow().isoformat()

        except Exception as e:
            run['status'] = 'failed'
            run['errors'].append(str(e))
            run['failed_at'] = datetime.utcnow().isoformat()
            logger.error(f"Pipeline {pipeline_id} failed at step {i}: {e}")

        store.save('pipeline_runs', run_id, run)
        return run

    def _execute_step(self, step, params, run):
        step_type = step.get('type')

        if step_type == 'extract':
            return self._extract(step, params)
        elif step_type == 'transform':
            return self._transform(step, params)
        elif step_type == 'load':
            return self._load(step, params)
        elif step_type == 'script':
            return self._run_script(step, params)
        else:
            raise ValueError(f"Unknown step type: {step_type}")

    def _extract(self, step, params):
        source_id = step.get('source')
        query = step.get('query', '')
        # Substitute parameters into query
        for key, value in (params or {}).items():
            query = query.replace(f'{{{key}}}', str(value))
        return {'type': 'extract', 'query': query, 'rows_extracted': 0}

    def _transform(self, step, params):
        transform_type = step.get('transform')
        config = step.get('config', {})
        return {'type': 'transform', 'transform': transform_type, 'rows_processed': 0}

    def _load(self, step, params):
        target = step.get('target')
        mode = step.get('mode', 'append')  # append, overwrite, upsert
        return {'type': 'load', 'target': target, 'mode': mode, 'rows_loaded': 0}

    def _run_script(self, step, params):
        script = step.get('script', '')
        language = step.get('language', 'python')

        if language == 'python':
            result = subprocess.run(
                ['python', '-c', script],
                capture_output=True, text=True, timeout=300
            )
        elif language == 'bash':
            result = subprocess.run(
                script, shell=True,
                capture_output=True, text=True, timeout=300
            )
        else:
            raise ValueError(f"Unsupported script language: {language}")

        if result.returncode != 0:
            raise RuntimeError(f"Script failed: {result.stderr}")

        return {'type': 'script', 'output': result.stdout[:1000]}

    def list_pipelines(self, user_id=None):
        return store.list('pipelines')

    def list_runs(self, pipeline_id):
        all_runs = store.list('pipeline_runs')
        return [r for r in all_runs if r.get('pipeline_id') == pipeline_id]

    def count_pipelines(self):
        return len(store.list('pipelines'))
