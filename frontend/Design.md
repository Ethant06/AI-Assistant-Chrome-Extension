# Components Requirements

### Auth Pages (/login, /register)

```
button      submit buttons
input       email and password fields
card        the centered auth container
label       form labels (may come bundled with input)
```

### Documents Page (/documents)
```
card             document list items
badge            status pills — processing / ready / failed
button           add document, delete actions
dialog           "Add document" modal
input            title field, search
textarea         pasting raw content
dropdown-menu    per-document actions (rename, delete)
skeleton         loading placeholders while documents fetch
sonner           toast notifications for success/error
```

### Chat Page (/chat)
```
scroll-area   message list with a styled scrollbar
textarea      the message input
button        send button
card          source citation cards below assistant messages
avatar        user vs assistant message indicators
separator     dividing messages or sections
```

### Layout (sidebar, navbar)
```
button          nav items, sign out
separator       section dividers in the sidebar
dropdown-menu   user menu in the navbar
tooltip         icon-only button labels
avatar          user avatar in the navbar
```

### Extras
```
- alrt dialog - for deleting confirmations
- tabs - if add-document modal has URL/paste tabs
- sidebar
```