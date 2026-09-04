# How documents/page.tsx, documents/DocumentActions.tsx, documents/DocumentCard.tsx, and documents/rename-dialog relate and work together.

# 1. Child can't do the rename itself
ResumeDialog is responsible for the user renaming input, but it can't update the list since page owns the list.
```
page.tsx

const [documents, setDocuments] = useState<Document[]>([])
```
RenameDialog has no access to setDocuments, so it can't do the work itself - it has to ask the page. OnRename is that ask.

# 2. The chain. Page defines what actually happens
```
async function handleRename(id, title) {
    const updated = await updateDocument(id, { title })
    setDocuments(prev => prev.map(d => d.id === id ? updated : d))
}
```
Page hands it to the card:
```
<DocumentCard onRename={handleRename} />
```
Card hands it to the actions menu unchanged
```
<DocumentActions onRename={onRename} />
```
Actions attaches the document ID before handing it to dialog:
```
<RenameDialog onRename={(title) => onRename(document.id, title)} />
```

Then dialog calls it with just the title:
```
await onRename(trimmed)
```

```
The key moment
Look at this line in DocumentActions:

onRename={(title) => onRename(document.id, title)}

It's creating a new function that already knows the ID. So when the dialog calls onRename("New Title"), what actually runs is handleRename(3, "New Title") back in the page.
That's why RenameDialog only needs the title — the ID was baked in one level up.
```


# Takeaway
```
1. Dialog calls:  onRename("New Title")
                        ↓
2. Which is really:  handleRename(3, "New Title")  ← runs in the PAGE
                        ↓
3. Inside the page:
       const updated = await updateDocument(3, { title })
       setDocuments(prev => prev.map(d => d.id === 3 ? updated : d))
                        ↓
4. documents state changed → React re-renders the page
                        ↓
5. Page re-renders its cards with the NEW array:
       {documents.map(doc => <DocumentCard document={doc} />)}
                        ↓
6. The card for id=3 now receives a document with the new title
                        ↓
7. Card displays "New Title"


onRename is handleRename. It's the same function — just referred to by a different name in the child.
```