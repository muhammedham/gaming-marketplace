# Known medium items after final feature freeze

There are no known functional Blocker or High defects in the tested MVP acceptance paths.

1. The production Web build reports one bundle-size warning because the MVP is currently delivered as one main client chunk. It does not fail build or runtime; route-level code splitting is the next performance improvement.
2. User profile-photo upload and Category/Game image management are not implemented. Initial avatars and text taxonomy keep every required Sprint flow usable.
3. Listings have no stock/quantity model. A Seller should deactivate a one-off digital product after sale; Admin and Seller can both do this.
4. Polling is intentionally used instead of Socket.IO. Message/order/notification freshness is up to five seconds.
5. Local upload storage is suitable for this single-machine MVP. Multi-instance production would require object storage and shared media lifecycle handling.
6. Admin status actions are intentionally conservative. `SupportPaused` settlement must go through its ticket, and reactivating taxonomy never republishes listings automatically.
