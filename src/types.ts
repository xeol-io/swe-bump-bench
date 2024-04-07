export interface RepoCsvItem {
  name: string;
  owner: string;
  pr_url: string;
  pr_title: string;
  number: number;
  branch_name: string;
  pkg_manager?: string;
  package?: string;
  version_from?: string;
  version_to?: string;
  node_version?: string;
  event: string;
  diff?: string;
  merged: string;
  commits: string;
  base_sha: string;
  changed_files: string;
}
