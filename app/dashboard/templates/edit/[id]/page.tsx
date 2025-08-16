import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs"
import ProfessionalCertificateEditor from "@/professional-certificate-editor"

const EditTemplatePage = ({ params, template, handleEditorStateChange }) => {
  return (
    <div>
      <Tabs defaultValue="design">
        <TabsList>
          <TabsTrigger value="design">Design</TabsTrigger>
          {/* Other tabs triggers here */}
        </TabsList>
        <TabsContent value="design" className="mt-6">
          {/* FIX: Ajustado o container para conter o conteúdo e permitir scroll quando necessário */}
          <div className="relative h-[calc(100vh-250px)] w-full overflow-auto">
            <div className="min-w-fit">
              <ProfessionalCertificateEditor
                key={`cert-${template.id}`}
                templateId={params.id}
                initialTemplate={template.template_data}
                onStateChange={handleEditorStateChange}
              />
            </div>
          </div>
        </TabsContent>
        {/* Other tabs content here */}
      </Tabs>
    </div>
  )
}

export default EditTemplatePage
