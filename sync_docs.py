import os
import subprocess
import shutil
import re

DOCS_REPO = r"C:\Users\aminu\OneDrive\Documents\GitHub\onennabe-docs"
WEBSITE_REPO = r"C:\Users\aminu\OneDrive\Documents\GitHub\Website"

def run_cmd(cmd, cwd):
    print(f"Running: {cmd}\nIn directory: {cwd}")
    subprocess.run(cmd, cwd=cwd, shell=True, check=True)

def sync_fork():
    print("\n--- 1. Syncing onennabe-docs fork ---")
    run_cmd("git fetch upstream", DOCS_REPO)
    run_cmd("git merge upstream/main", DOCS_REPO)
    run_cmd("git push origin main", DOCS_REPO)

def copy_tree_preserve(src, dst):
    """Copies a directory tree but preserves existing files in the destination that aren't in the source."""
    if not os.path.exists(dst):
        os.makedirs(dst)
    for item in os.listdir(src):
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            copy_tree_preserve(s, d)
        else:
            shutil.copy2(s, d)

def copy_files():
    print("\n--- 2. Copying files to Website repo ---")
    src_docs = os.path.join(DOCS_REPO, "docs")
    dest_docs = os.path.join(WEBSITE_REPO, "docs")
    
    # Use the safe copy to ensure your custom local files (like translate.js) aren't deleted!
    copy_tree_preserve(src_docs, dest_docs)
    
    shutil.copy2(os.path.join(DOCS_REPO, "mkdocs.yml"), os.path.join(WEBSITE_REPO, "mkdocs.yml"))
    shutil.copy2(os.path.join(DOCS_REPO, "steamunlock_wannabe.ico"), os.path.join(WEBSITE_REPO, "steamunlock_wannabe.ico"))

def patch_mkdocs_yml():
    print("\n--- 3. Patching mkdocs.yml for main website ---")
    mkdocs_path = os.path.join(WEBSITE_REPO, "mkdocs.yml")
    with open(mkdocs_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update site_url and add site_dir
    content = re.sub(r"site_url:\s*.*", "site_url: https://steamunlockonennabe.click/docs/\nsite_dir: public/docs", content)
    
    # 2. Re-inject your custom local translation CSS if it got overwritten
    if "stylesheets/translate.css" not in content and "extra_css:" in content:
        content = content.replace("extra_css:\n", "extra_css:\n  - stylesheets/translate.css\n")
        
    # 3. Re-inject your custom local translation JS if it got overwritten
    if "extra_javascript:" not in content:
        content += "\n\nextra_javascript:\n  - javascripts/translate.js\n"
    elif "javascripts/translate.js" not in content:
        content = content.replace("extra_javascript:\n", "extra_javascript:\n  - javascripts/translate.js\n")

    with open(mkdocs_path, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    print("Starting sync process...")
    try:
        sync_fork()
        copy_files()
        patch_mkdocs_yml()
        print("\n✅ Successfully synced docs and copied to Website repository!")
    except Exception as e:
        print(f"\n❌ Error occurred: {e}")
