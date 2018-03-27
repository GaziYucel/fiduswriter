import {configureCitationTemplate, citationItemTemplate, selectedCitationTemplate} from "./templates"
import {BibEntryForm} from "../../bibliography/form"
import {setCheckableLabel, Dialog, findTarget} from "../../common"
import {nameToText, litToText} from "../../bibliography/tools"
import * as plugins from "../../../plugins/citation_dialog"

export class CitationDialog {
    constructor(editor) {
        this.editor = editor
        this.initialReferences = []
        this.initialFormat = 'autocite'
        this.node = this.editor.currentView.state.selection.node
        this.dialog = false
        this.buttons = []
        this.submitButtonText = gettext('Insert')
    }

    init() {
        if (this.node && this.node.type && this.node.type.name==='citation') {
            this.initialFormat = this.node.attrs.format
            this.initialReferences = this.node.attrs.references
        }

        this.buttons.push({
            text: gettext('Register new source'),
            click: () => this.registerNewSource(),
            classes: 'fw-light fw-add-button register-new-bib-source'
        })

        if (this.node && this.node.type && this.node.type.name==='citation') {
            this.buttons.push({
                text: gettext('Remove'),
                click: () => {
                    let transaction = this.editor.currentView.state.tr.deleteSelection()
                    this.editor.currentView.dispatch(transaction)
                    this.dialog.close()
                },
                classes: 'fw-orange'
            })
            this.submitButtonText = gettext('Update')
        }

        this.buttons.push({
            text: this.submitButtonText,
            click: () => {
                if (this.dialogSubmit()) {
                    this.dialog.close()
                }
            },
            classes: "fw-dark insert-citation"
        })

        this.buttons.push({
            type: 'cancel'
        })

        this.activatePlugins()

        this.dialog = new Dialog({
            id: 'configure-citation',
            title: gettext('Configure Citation'),
            buttons: this.buttons,
            body: this.citationDialogHTML(),
            width: 836,
            height: 540,
            onClose: () => this.editor.currentView.focus()
        })
        this.dialog.open()
        this.bind()
    }

    activatePlugins() {
        // Add plugins
        this.plugins = {}

        Object.keys(plugins).forEach(plugin => {
            if (typeof plugins[plugin] === 'function') {
                this.plugins[plugin] = new plugins[plugin](this)
                this.plugins[plugin].init()
            }
        })
    }

    citationDialogHTML() {
        // Assemble the HTML of the 'citable' and 'cited' columns of the dialog,
        // and return the templated dialog HTML.
        let citableItemsHTML = '', citedItemsHTML = ''

        Object.keys(this.editor.mod.db.bibDB.db).forEach(id => {
            let bibEntry = this.bibDBToBibEntry(this.editor.mod.db.bibDB.db[id], id, 'document')
            citableItemsHTML += citationItemTemplate(bibEntry)

            let citEntry = this.initialReferences.find(bibRef => bibRef.id==id)

            if (citEntry) {
                bibEntry.prefix = citEntry.prefix ?  citEntry.prefix : ''
                bibEntry.locator = citEntry.locator ? citEntry.locator : ''
                citedItemsHTML += selectedCitationTemplate(bibEntry)
            }
        })
        Object.keys(this.editor.user.bibDB.db).forEach(id => {
            let bib = this.editor.user.bibDB.db[id]
            if (!this.editor.mod.db.bibDB.hasReference(bib)) {
                let bibEntry = this.bibDBToBibEntry(bib, id, 'user')
                citableItemsHTML += citationItemTemplate(bibEntry)
            }
        })

        return configureCitationTemplate({
            citableItemsHTML,
            citedItemsHTML,
            citeFormat: this.initialFormat
        })
    }

    registerNewSource() {
        let form = new BibEntryForm(this.editor.mod.db.bibDB)
        form.init().then(
            idTranslations => {
                let ids = idTranslations.map(idTrans => idTrans[1])
                this.addToCitableItems(ids)
            }
        )
    }

    bibDBToBibEntry(bib, id, db) {
        let bibauthors = bib.fields.author || bib.fields.editor
        return {
            id,
            db,
            bib_type: bib.bib_type,
            title: bib.fields.title ? litToText(bib.fields.title) : gettext('Untitled'),
            author: bibauthors ? nameToText(bibauthors) : ''
        }
    }

    // Update the citation dialog with new items in 'citable' column.
    // Not when dialog is first opened.
    addToCitableItems(ids) {
        ids.forEach(id => {
            let citeItemData = this.bibDBToBibEntry(this.editor.mod.db.bibDB.db[id], id, 'document')
            document.querySelector('#cite-source-table > tbody').insertAdjacentHTML('beforeend', citationItemTemplate(citeItemData))
            this.addToCitedItems([citeItemData])
        })
        jQuery('#cite-source-table').trigger('update')
    }

    // Update the citation dialog with new items in 'cited' column.
    // Not when dialog is first opened.
    addToCitedItems(items) {
        let len = items.length
        for(let i = 0; i < len; i ++) {
            let item = items[i]
            document.querySelector('#selected-cite-source-table .fw-document-table-body').insertAdjacentHTML(
                'beforeend',
                selectedCitationTemplate({
                    id: item.id,
                    db: item.db,
                    bib_type: item.bib_type,
                    title: item.title,
                    author: item.author,
                    locator: '',
                    prefix: ''
                })
            )
        }
    }

    bind() {
        jQuery('#cite-source-table').bind('update', function() {
            let autocomplete_tags = []
            if (this.classList.contains('dataTable')) {
                jQuery(this).dataTable({
                    "bRetrieve": true,
                })
            } else {
                jQuery(this).dataTable({
                    "bPaginate": false,
                    "bLengthChange": false,
                    "bFilter": true,
                    "bInfo": false,
                    "bAutoWidth": false,
                    "oLanguage": {
                        "sSearch": ''
                    },
                })
            }
            document.querySelector('#cite-source-table_filter input').setAttribute('placeholder', gettext('Search bibliography'))

            document.querySelectorAll('#cite-source-table .fw-searchable').forEach(el =>  autocomplete_tags.push(el.textContent))
            autocomplete_tags = [...new Set(autocomplete_tags)] // unique values
            jQuery("#cite-source-table_filter input").autocomplete({
                source: autocomplete_tags
            })
        })

        jQuery('#cite-source-table').trigger('update')

        document.getElementById('add-cite-source').addEventListener('click', () => {
            let selectedItems = []

            document.querySelectorAll('#cite-source-table .fw-checkable.checked').forEach(
                el => {
                    let id = el.dataset.id,
                        db = el.dataset.db
                    if (document.querySelector(`#selected-source-${db}-${id}`)) {
                        return
                    }
                    selectedItems.push({
                        id,
                        db,
                        type: el.dataset.type,
                        title: el.dataset.title,
                        author: el.dataset.author
                    })
                    el.classList.remove('checked')
                }
            )

            this.addToCitedItems(selectedItems)
        })

        this.dialog.dialogEl.addEventListener('click', event => {
            let el = {}, revisionId
            switch (true) {
                case findTarget(event, '.selected-source .delete', el):
                    let documentEl = document.getElementById(`selected-source-document-${el.target.dataset.id}`)
                    if (documentEl) {
                        documentEl.parentElement.removeChild(documentEl)
                    }
                    break
                case findTarget(event, '.fw-checkable', el):
                    setCheckableLabel(el.target)
                    break
                default:
                    break
            }
        })
    }

    dialogSubmit() {
        let citeItems = [].slice.call(
                document.querySelectorAll('#selected-cite-source-table .fw-cite-parts-table')
            ),
            references = citeItems.map(bibRef => {
                let deleteButton = bibRef.querySelector('.delete'),
                    id = parseInt(deleteButton.dataset.id),
                    db = deleteButton.dataset.db
                if (db === 'user') {
                    // entry is from user's bibDB. We need to import it into the
                    // document's bibDB.
                    let bib = this.editor.user.bibDB.db[id]
                    id = this.editor.mod.db.bibDB.addReference(bib, id)
                }
                let returnObj = {
                    id
                }
                let prefix = bibRef.querySelector('.fw-cite-text').value
                if (prefix.length) {
                    returnObj['prefix'] = prefix
                }
                let locator = bibRef.querySelector('.fw-cite-page').value
                if (locator.length) {
                    returnObj['locator'] = locator
                }
                return returnObj
            })

        if (0 === citeItems.length) {
            window.alert(gettext('Please select at least one citation source!'))
            return false
        }

        let format = document.getElementById('citation-style-selector').value

        if (
            JSON.stringify(references) === JSON.stringify(this.initialReferences) &&
            format == this.initialFormat
        ) {
            // Nothing has been changed, so we just close the dialog again
            return true
        }

        let citationNode = this.editor.currentView.state.schema.nodes['citation'].create({format, references})
        let transaction = this.editor.currentView.state.tr.replaceSelectionWith(citationNode, true)
        this.editor.currentView.dispatch(transaction)
        return true
    }
}