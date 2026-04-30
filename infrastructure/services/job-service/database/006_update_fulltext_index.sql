-- Rebuild FULLTEXT index to include company_name
ALTER TABLE job_postings DROP INDEX ft_job_postings_search;
ALTER TABLE job_postings ADD FULLTEXT KEY ft_job_postings_search (title, description, company_name);
