-- Delete duplicate proposals, keeping only the latest per prospect
DELETE FROM proposals
WHERE id NOT IN (
  SELECT DISTINCT ON (prospect_id) id
  FROM proposals
  ORDER BY prospect_id, created_at DESC
);

-- Add unique constraint on prospect_id
ALTER TABLE proposals ADD CONSTRAINT proposals_prospect_id_unique UNIQUE (prospect_id);