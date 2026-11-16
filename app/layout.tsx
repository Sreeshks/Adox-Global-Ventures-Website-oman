import type {Metadata} from 'next';
export const metadata:Metadata={title:'Adox Global Ventures | Website Admin',description:'Secure website content editor for Adox Global Ventures.',robots:{index:false,follow:false},icons:{icon:'/assets/adox-global-ventures-original.jpg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body style={{margin:0}}>{children}</body></html>}
