# Agent Chat Issue: GPT Mini Returns "Corrupted Content" Error

## Problem Summary

When using the GPT Mini agent with Portfolio 1 and English language, sending "Hello" resulted in the error:
> "Hello! Based on the provided context, the files (including 'Houston Neighborhoods.xlsx' and a source labeled 'NAME') contain unreadable or corrupted content..."

Meanwhile, the Mistral agent worked perfectly with the same settings.

## Root Cause Analysis

### Investigation Steps
1. **Agent Configuration**: Both agents (GPT Mini and Mistral) were correctly configured with valid models and credentials.
2. **RAG Context Retrieval**: The issue was NOT with the model or API, but with the RAG context being retrieved.
3. **Corrupted Data Discovery**: Found that a file named `Houston Neighborhoods.xlsx` had been uploaded when the file upload system wasn't working properly, resulting in **binary/corrupted RAG chunks**.

### Technical Details

**Location of problematic files:**
- `/static/uploads/projects/2/attachments/Houston Neighborhoods.xlsx`
- `/static/uploads/portfolios/1/attachments/Houston Neighborhoods.xlsx`

**Database issue:**
- Project attachment ID 4 had 8 RAG chunks (IDs: 26, 1261-1267)
- These chunks contained **raw binary Excel file data** (ZIP/XML format) instead of properly extracted text
- Example of corrupted data: `PK\u0003\u0004\u0014�\u0006�\b���!�bh^\u0001��\u0004��\u0013�\b\u0002[Content_Types].xml`

**Why it affected GPT Mini but not Mistral:**
- Both agents retrieve the same RAG chunks
- However, the **randomness in vector search ranking** and the **LLM's interpretation** varied
- GPT Mini happened to retrieve these corrupted chunks with higher priority for the "Hello" query
- Mistral either didn't retrieve them or interpreted the context differently

## Solution

### Files Created
1. **fix_corrupted_excel_chunks.sql** - SQL script to clean the database
2. **fix_agent_chat.sh** - Bash script to automate the complete fix

### Fix Steps

**Option 1: Automated (Recommended)**
```bash
cd /home/andres/projects/portfolio-suite/portfolio-backend
./fix_agent_chat.sh
```

**Option 2: Manual**
```bash
# 1. Clean database
cd /home/andres/projects/portfolio-suite/portfolio-backend
source venv/bin/activate
psql -d portfolio_db -f fix_corrupted_excel_chunks.sql

# 2. Remove physical files
rm -f "static/uploads/projects/2/attachments/Houston Neighborhoods.xlsx"
rm -f "static/uploads/portfolios/1/attachments/Houston Neighborhoods.xlsx"
```

### What the Fix Does
1. **Soft-deletes** the 8 corrupted RAG chunks (marks `is_deleted = TRUE`)
2. **Deletes** the RAG embeddings associated with these chunks
3. **Removes** the project attachment record from the database
4. **Deletes** the physical Excel files from the filesystem

## Prevention

To prevent this issue in the future:

1. **File Upload Validation**: Ensure the file upload system properly extracts text from Excel/Office files
2. **RAG Chunk Validation**: Add validation to detect binary/corrupted data before storing chunks
3. **File Processing**: Use proper libraries (like `openpyxl`, `pandas`) to extract text from Excel files
4. **Error Handling**: Add try-catch around file processing to prevent corrupted chunks from being saved

## Testing After Fix

1. **Test GPT Mini agent**:
   - Go to Agent Chat in the UI
   - Select "GPT Mini agent"
   - Select Portfolio 1
   - Select English language
   - Send message: "Hello"
   - **Expected**: Should get a friendly greeting response without corrupted content errors

2. **Test Mistral agent**: Should continue to work as before

3. **Test portfolio queries**:
   - "What React projects are there?"
   - "Tell me about work experience"
   - Should return clean, relevant information from the portfolio

## Re-uploading the File (Optional)

If you need the Houston Neighborhoods.xlsx file in the system:

1. Use the proper file upload feature in the UI (Portfolio Attachments or Project Attachments)
2. The system should now correctly parse the Excel file and extract readable text
3. Verify that the RAG chunks contain actual text content, not binary data

## Technical Notes

- **Model names**: Both `gpt-5-mini` and `gpt-4o-mini` are valid OpenAI models
- **RAG retrieval**: Doesn't filter by language_code by design (allows cross-language search)
- **Conversational queries**: The system correctly detects greetings like "Hello" but still performs RAG search when portfolio is specified
- **Vector search**: Uses cosine similarity with OpenAI embeddings (`text-embedding-3-small`)
