// IFileOperation's recycle-only flag avoids SHFileOperation/VisualBasic's
// ALLOWUNDO behavior, which may permanently delete on non-recyclable volumes.
export const windowsTrashScript = String.raw`
using System;
using System.Runtime.InteropServices;
public static class AttangerTrash {
  [ComImport, Guid("947AAB5F-0A5C-4C13-B4D6-4BF7836FC9F8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileOperation {
    [PreserveSig] int Advise(IntPtr sink, out uint cookie);
    [PreserveSig] int Unadvise(uint cookie);
    [PreserveSig] int SetOperationFlags(uint flags);
    [PreserveSig] int SetProgressMessage([MarshalAs(UnmanagedType.LPWStr)] string message);
    [PreserveSig] int SetProgressDialog(IntPtr dialog);
    [PreserveSig] int SetProperties(IntPtr properties);
    [PreserveSig] int SetOwnerWindow(IntPtr window);
    [PreserveSig] int ApplyPropertiesToItem(IntPtr item);
    [PreserveSig] int ApplyPropertiesToItems(IntPtr items);
    [PreserveSig] int RenameItem(IntPtr item, [MarshalAs(UnmanagedType.LPWStr)] string name, IntPtr sink);
    [PreserveSig] int RenameItems(IntPtr items, [MarshalAs(UnmanagedType.LPWStr)] string name);
    [PreserveSig] int MoveItem(IntPtr item, IntPtr folder, [MarshalAs(UnmanagedType.LPWStr)] string name, IntPtr sink);
    [PreserveSig] int MoveItems(IntPtr items, IntPtr folder);
    [PreserveSig] int CopyItem(IntPtr item, IntPtr folder, [MarshalAs(UnmanagedType.LPWStr)] string name, IntPtr sink);
    [PreserveSig] int CopyItems(IntPtr items, IntPtr folder);
    [PreserveSig] int DeleteItem(IntPtr item, IntPtr sink);
    [PreserveSig] int DeleteItems(IntPtr items);
    [PreserveSig] int NewItem(IntPtr folder, uint attributes, [MarshalAs(UnmanagedType.LPWStr)] string name, [MarshalAs(UnmanagedType.LPWStr)] string template, IntPtr sink);
    [PreserveSig] int PerformOperations();
    [PreserveSig] int GetAnyOperationsAborted([MarshalAs(UnmanagedType.Bool)] out bool aborted);
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
  static extern int SHCreateItemFromParsingName(string path, IntPtr bind, ref Guid iid, out IntPtr item);
  public static void Recycle(string path) {
    // Network shares cannot supply a local Recycle Bin.
    var drive = new System.IO.DriveInfo(System.IO.Path.GetPathRoot(path));
    if (drive.DriveType != System.IO.DriveType.Fixed) throw new System.IO.IOException("Recycling requires a fixed local volume");
    IntPtr item = IntPtr.Zero;
    IFileOperation operation = null;
    try {
      Guid iid = new Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE");
      Marshal.ThrowExceptionForHR(SHCreateItemFromParsingName(path, IntPtr.Zero, ref iid, out item));
      operation = (IFileOperation)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("3AD05575-8857-4850-9277-11B85BDB8E09")));
      // RECYCLEONDELETE | EARLYFAILURE | SILENT | NOCONFIRMATION | NOERRORUI.
      Marshal.ThrowExceptionForHR(operation.SetOperationFlags(0x00080000 | 0x00100000 | 0x0004 | 0x0010 | 0x0400));
      Marshal.ThrowExceptionForHR(operation.DeleteItem(item, IntPtr.Zero));
      Marshal.ThrowExceptionForHR(operation.PerformOperations());
      bool aborted;
      Marshal.ThrowExceptionForHR(operation.GetAnyOperationsAborted(out aborted));
      if (aborted) throw new System.IO.IOException("Recycling was aborted");
    } finally {
      if (item != IntPtr.Zero) Marshal.Release(item);
      if (operation != null) Marshal.FinalReleaseComObject(operation);
    }
  }
}
`;
