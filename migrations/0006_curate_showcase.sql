UPDATE runs
SET metadata_json = json_set(COALESCE(metadata_json, '{}'), '$.listed', json('false'))
WHERE COALESCE((SELECT MIN(artifact_revisions.created_at) FROM artifact_revisions WHERE artifact_revisions.run_id = runs.id AND artifact_revisions.status = 'accepted'), created_at) < 1784392071657
   OR lower(COALESCE(json_extract(concept_json, '$.appName'), '')) GLOB 'mcp primary*'
   OR lower(COALESCE(json_extract(concept_json, '$.appName'), '')) GLOB 'mcp audio*'
   OR lower(COALESCE(json_extract(concept_json, '$.appName'), '')) GLOB 'mcp asset*'
   OR lower(COALESCE(json_extract(concept_json, '$.appName'), '')) GLOB 'mcp repair*'
   OR lower(COALESCE(json_extract(concept_json, '$.appName'), '')) GLOB 'gate 5 specimen*'
   OR lower(COALESCE(json_extract(concept_json, '$.appName'), '')) GLOB 'synthetic *'
   OR lower(COALESCE(json_extract(concept_json, '$.appName'), '')) GLOB 'browser chrome check*'
   OR lower(request_id) GLOB 'synthetic-*'
   OR lower(request_id) GLOB 'browser-*'
   OR lower(request_id) GLOB 'gate-*';
